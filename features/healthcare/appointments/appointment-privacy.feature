@healthcare @api @REQ-APPT-004 @REQ-APPT-005
Feature: Privacy of appointment information
  As a member
  I want my reason for visit and my appointments disclosed only where needed
  So that my health information stays private

  These checks show how the reference app behaves. They do not establish compliance with HIPAA,
  GDPR or any other regulation.

  @security @AC-APPT-004.1
  Scenario: Appointment lists leave out the reason for visit
    Given a synthetic "Family Medicine" provider offers 1 time
    And the first time of that provider has been booked through the API
    When the member lists their appointments through the API
    Then the listed appointment does not include the reason for visit

  @security @AC-APPT-004.3
  Scenario: The reason for visit is not written to the execution log
    Given a synthetic "Family Medicine" provider offers 1 time
    When the member tries to book that time through the API with a distinctive synthetic reason for visit
    Then the booking request is accepted
    And the execution log does not contain that reason for visit

  @negative @AC-APPT-004.2
  Scenario: An unknown appointment identifier is reported as not found
    When the member requests an appointment with an identifier that is not theirs
    Then the appointment is reported as not found

  @manual @security @AC-APPT-004.2
  Scenario: Another member's appointment is not disclosed
    Given a second synthetic member has booked an appointment
    When the first member requests that appointment by its identifier
    Then the appointment is reported as not found
    And the response does not reveal that the appointment exists

  @blocked @security @AC-APPT-005.1
  Scenario: Cancelled appointments are kept only as long as the retention policy allows
    Given a synthetic appointment was cancelled longer ago than the retention period
    When the retention process has run
    Then the appointment is no longer stored
