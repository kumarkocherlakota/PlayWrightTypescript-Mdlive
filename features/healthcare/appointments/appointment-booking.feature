@healthcare @ui @api-setup @REQ-APPT-001
Feature: Book an appointment in the patient portal
  As a member
  I want to book an available time with a provider
  So that I have a confirmed appointment

  The maximum reason-for-visit length comes from healthcare.appointmentPolicy (C-08).

  Background:
    Given the member is signed in to the patient portal
    And a synthetic "Family Medicine" provider offers 2 times

  @smoke @critical @positive @AC-APPT-001.1
  Scenario: A member books an available time
    When the member books the first time of that provider in the portal with a synthetic reason for visit
    Then the booking summary showed that provider and time
    And the portal confirms the booking with a reference for the chosen time

  @boundary @AC-APPT-001.3
  Scenario: A reason for visit longer than allowed is refused with a field error
    When the member books the first time of that provider in the portal with a reason of 1 character over the maximum length
    Then the booking is refused with an error message associated with "Reason for visit"

  @negative @AC-APPT-001.3
  Scenario: A booking without a reason for visit is refused with a field error
    When the member books the first time of that provider in the portal with a reason of no characters
    Then the booking is refused with an error message associated with "Reason for visit"
