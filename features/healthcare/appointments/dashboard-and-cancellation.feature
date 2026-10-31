@healthcare @integration @REQ-APPT-001 @REQ-APPT-002 @REQ-APPT-003
Feature: Appointment dashboard and cancellation across portal and API
  As a member
  I want my dashboard to show my appointments as the service records them
  So that I can rely on it and cancel appointments I no longer need

  Each scenario drives the portal and prepares or verifies through the API for the same
  synthetic member. Rows are identified by appointment reference, never by position.

  Background:
    Given the member is signed in to the patient portal
    And a synthetic "Dermatology" provider offers 2 times

  @smoke @positive @AC-APPT-002.1
  Scenario: An appointment booked through the API appears on the dashboard
    Given the first time of that provider has been booked through the API
    When the member views that appointment on the dashboard
    Then the dashboard shows it as "Booked" with its provider, specialty and time

  @positive @AC-APPT-002.2
  Scenario: An appointment booked in the portal is recorded by the service
    When the member books the first time of that provider in the portal with a synthetic reason for visit
    Then the API returns the confirmed appointment with the chosen time and reason for visit

  @smoke @critical @positive @AC-APPT-003.1
  Scenario: Cancelling on the dashboard cancels the appointment
    Given the first time of that provider has been booked through the API
    When the member cancels that appointment on the dashboard
    Then the dashboard announces that the appointment is cancelled
    And the dashboard shows it as "Cancelled" without a cancel option
    And the API reports that appointment as cancelled

  @positive @AC-APPT-003.5
  Scenario: A cancellation made through the API is shown on the dashboard
    Given the first time of that provider has been booked through the API
    And that appointment has been cancelled through the API
    When the member views that appointment on the dashboard
    Then the dashboard shows it as "Cancelled" without a cancel option

  @negative @AC-APPT-003.2
  Scenario: The dashboard explains why a late cancellation is refused
    Given a synthetic "Cardiology" provider offers a time 5 minutes inside the cancellation cutoff
    And the first time of that provider has been booked through the API
    When the member cancels that appointment on the dashboard
    Then the dashboard explains that appointments inside the cancellation cutoff cannot be cancelled online
    And the API reports that appointment as booked

  @accessibility @AC-APPT-003.4
  Scenario: Keeping the appointment closes the dialog and changes nothing
    Given the first time of that provider has been booked through the API
    When the member starts to cancel that appointment on the dashboard but keeps it
    Then the cancellation dialog titled "Cancel appointment?" had keyboard focus
    And the dashboard still shows it as "Booked"

  @negative @AC-APPT-001.2
  Scenario: A time booked meanwhile is refused in the portal
    Given the member has chosen the first time of that provider in the portal
    And that time has meanwhile been booked through the API
    When the member confirms the booking with a synthetic reason for visit
    Then the booking page says "This time is no longer available. Choose another time."
