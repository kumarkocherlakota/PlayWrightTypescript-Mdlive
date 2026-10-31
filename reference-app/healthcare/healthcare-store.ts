import { randomBytes, randomUUID } from 'node:crypto';
import { HttpProblem } from '../routing';
import type { ReferenceAppointmentPolicy } from './appointment-policy';

/**
 * In-memory synthetic provider directory and appointment book. Every record is fictitious and is
 * lost when the process stops. The rules are fixture rules (see appointment-policy.ts) and are
 * not a model of any real scheduling system.
 */
export interface ProviderRecord {
  readonly id: string;
  readonly name: string;
  readonly specialty: string;
  readonly location: string;
  /** Subject that seeded the provider through test support; undefined for demo providers. */
  readonly seededBy: string | undefined;
}

export interface SlotRecord {
  readonly id: string;
  readonly providerId: string;
  readonly start: string;
  readonly durationMinutes: number;
}

interface AppointmentRecord {
  readonly id: string;
  readonly reference: string;
  readonly memberSubject: string;
  readonly slotId: string;
  readonly reasonForVisit: string;
  readonly bookedAt: string;
  status: 'booked' | 'cancelled';
  cancelledAt: string | undefined;
}

export interface NewSlot {
  readonly start: string;
  readonly durationMinutes: number;
}

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

export class HealthcareStore {
  private readonly providers = new Map<string, ProviderRecord>();
  private readonly slots = new Map<string, SlotRecord>();
  private readonly appointments = new Map<string, AppointmentRecord>();

  public constructor(
    public readonly policy: ReferenceAppointmentPolicy,
    private readonly now: () => number = Date.now,
  ) {}

  public addProvider(
    input: Omit<ProviderRecord, 'id'>,
    slots: readonly NewSlot[],
  ): { provider: ProviderRecord; slots: SlotRecord[] } {
    const provider: ProviderRecord = { id: randomUUID(), ...input };
    this.providers.set(provider.id, provider);
    const created = slots.map((slot) => {
      const record: SlotRecord = {
        id: randomUUID(),
        providerId: provider.id,
        start: new Date(slot.start).toISOString(),
        durationMinutes: slot.durationMinutes,
      };
      this.slots.set(record.id, record);
      return record;
    });
    return { provider, slots: created };
  }

  /** Removes a seeded provider with its slots and appointments; demo providers are kept. */
  public removeSeededProvider(id: string, subject: string): boolean {
    const provider = this.providers.get(id);
    if (provider?.seededBy !== subject) {
      return false;
    }
    for (const slot of [...this.slots.values()].filter((each) => each.providerId === id)) {
      for (const appointment of [...this.appointments.values()]) {
        if (appointment.slotId === slot.id) {
          this.appointments.delete(appointment.id);
        }
      }
      this.slots.delete(slot.id);
    }
    return this.providers.delete(id);
  }

  public searchProviders(criteria: {
    readonly name: string | undefined;
    readonly specialty: string | undefined;
  }): ProviderRecord[] {
    const name = criteria.name?.toLowerCase();
    return [...this.providers.values()]
      .filter((provider) => name === undefined || provider.name.toLowerCase().includes(name))
      .filter(
        (provider) => criteria.specialty === undefined || provider.specialty === criteria.specialty,
      )
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  public provider(id: string): ProviderRecord | undefined {
    return this.providers.get(id);
  }

  /** Future slots of a provider, earliest first, with availability. */
  public upcomingSlots(providerId: string): (SlotRecord & { available: boolean })[] {
    const now = this.now();
    return [...this.slots.values()]
      .filter((slot) => slot.providerId === providerId && Date.parse(slot.start) > now)
      .sort((left, right) => left.start.localeCompare(right.start))
      .map((slot) => ({ ...slot, available: this.activeBookingOf(slot.id) === undefined }));
  }

  public book(memberSubject: string, slotId: string, reasonForVisit: string): AppointmentRecord {
    const slot = this.slots.get(slotId);
    if (slot === undefined) {
      throw new HttpProblem(404, { error: 'slot_not_found' });
    }
    const startsInMs = Date.parse(slot.start) - this.now();
    if (startsInMs <= 0) {
      throw new HttpProblem(422, { error: 'slot_in_past' });
    }
    if (startsInMs > this.policy.bookingHorizonDays * DAY_MS) {
      throw new HttpProblem(422, {
        error: 'beyond_booking_horizon',
        bookingHorizonDays: this.policy.bookingHorizonDays,
      });
    }
    if (this.activeBookingOf(slotId) !== undefined) {
      throw new HttpProblem(409, { error: 'slot_unavailable' });
    }
    const appointment: AppointmentRecord = {
      id: randomUUID(),
      reference: `APT-${randomBytes(4).toString('hex').toUpperCase()}`,
      memberSubject,
      slotId,
      reasonForVisit,
      bookedAt: new Date(this.now()).toISOString(),
      status: 'booked',
      cancelledAt: undefined,
    };
    this.appointments.set(appointment.id, appointment);
    return appointment;
  }

  /** The member's own appointments, earliest first. Other members' records are never returned. */
  public appointmentsOf(memberSubject: string): AppointmentRecord[] {
    return [...this.appointments.values()]
      .filter((appointment) => appointment.memberSubject === memberSubject)
      .sort((left, right) => this.startOf(left).localeCompare(this.startOf(right)));
  }

  public appointmentOf(memberSubject: string, id: string): AppointmentRecord | undefined {
    const appointment = this.appointments.get(id);
    return appointment?.memberSubject === memberSubject ? appointment : undefined;
  }

  public cancel(memberSubject: string, id: string): AppointmentRecord {
    const appointment = this.appointmentOf(memberSubject, id);
    if (appointment === undefined) {
      throw new HttpProblem(404, { error: 'not_found' });
    }
    if (appointment.status === 'cancelled') {
      throw new HttpProblem(409, { error: 'already_cancelled' });
    }
    const startsInMs = Date.parse(this.startOf(appointment)) - this.now();
    if (startsInMs < this.policy.cancellationCutoffHours * HOUR_MS) {
      throw new HttpProblem(422, {
        error: 'cancellation_window_closed',
        cancellationCutoffHours: this.policy.cancellationCutoffHours,
      });
    }
    appointment.status = 'cancelled';
    appointment.cancelledAt = new Date(this.now()).toISOString();
    return appointment;
  }

  /**
   * API representation. The reason for visit is included only in the detail view (minimum
   * necessary): lists show what the dashboard needs and nothing more.
   */
  public view(appointment: AppointmentRecord, detail: boolean): Record<string, unknown> {
    const slot = this.slots.get(appointment.slotId);
    const provider = slot === undefined ? undefined : this.providers.get(slot.providerId);
    return {
      id: appointment.id,
      reference: appointment.reference,
      providerId: provider?.id,
      providerName: provider?.name,
      specialty: provider?.specialty,
      location: provider?.location,
      start: slot?.start,
      durationMinutes: slot?.durationMinutes,
      status: appointment.status,
      bookedAt: appointment.bookedAt,
      ...(appointment.cancelledAt === undefined ? {} : { cancelledAt: appointment.cancelledAt }),
      ...(detail ? { reasonForVisit: appointment.reasonForVisit } : {}),
    };
  }

  private activeBookingOf(slotId: string): AppointmentRecord | undefined {
    return [...this.appointments.values()].find(
      (appointment) => appointment.slotId === slotId && appointment.status === 'booked',
    );
  }

  private startOf(appointment: AppointmentRecord): string {
    return this.slots.get(appointment.slotId)?.start ?? '';
  }
}

/** Fictitious demo providers so the portal is not empty when started on its own. */
export function seedDemoProviders(store: HealthcareStore, now: number = Date.now()): void {
  const demo = [
    { name: 'Dr. Avery Synthetic', specialty: 'Family Medicine', location: 'Example Clinic North' },
    { name: 'Dr. Jordan Example', specialty: 'Cardiology', location: 'Example Heart Center' },
    { name: 'Dr. Riley Placeholder', specialty: 'Dermatology', location: 'Example Skin Clinic' },
  ];
  const startOfTomorrow = Math.ceil(now / DAY_MS) * DAY_MS;
  for (const provider of demo) {
    const slots = [1, 2, 3, 4, 5].flatMap((day) =>
      [9, 14].map((hour) => ({
        start: new Date(startOfTomorrow + (day - 1) * DAY_MS + hour * HOUR_MS).toISOString(),
        durationMinutes: 30,
      })),
    );
    store.addProvider({ ...provider, seededBy: undefined }, slots);
  }
}
