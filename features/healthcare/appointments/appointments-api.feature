@healthcare @api @REQ-APPT-001 @REQ-APPT-003
Feature: Appointments API
  As the patient portal
  I want to book and cancel appointments for the signed-in member
  So that appointments follow the configured appointment policy

  Booking horizon, cancellation cutoff and reason-for-visit length are read from
  healthcare.appointmentPolicy (C-04, C-06, C-08). Boundary times sit a few minutes either side of
  a limit, so the time a scenario takes cannot move them across it.

  @smoke @positive @AC-APPT-001.1
  Scenario: Booking an available time stores it as requested
    Given a synthetic "Cardiology" provider offers 2 times
    When the member books the first time of that provider through the API
    Then the appointment is booked as requested
    And the appointment can be retrieved with its reason for visit

  @negative @AC-APPT-001.2
  Scenario: A time cannot be booked twice
    Given a synthetic "Cardiology" provider offers 1 time
    And the first time of that provider has been booked through the API
    When the member tries to book that time again through the API
    Then the booking request is refused with status 409 and error "slot_unavailable"

  @boundary @AC-APPT-001.3
  Scenario Outline: Reason for visit length limits
    Given a synthetic "Dermatology" provider offers 1 time
    When the member tries to book that time through the API with a reason of <length>
    Then the booking request is <outcome>

    Examples:
      | length                              | outcome                                      |
      | no characters                       | rejected because "reasonForVisit" is invalid |
      | 1 character                         | accepted                                     |
      | the maximum length                  | accepted                                     |
      | 1 character over the maximum length | rejected because "reasonForVisit" is invalid |

  @boundary @AC-APPT-001.4
  Scenario Outline: Booking horizon
    Given a synthetic "Pediatrics" provider offers a time 5 minutes <side> the booking horizon
    When the member tries to book that time through the API with a synthetic reason for visit
    Then the booking request is <outcome>

    Examples:
      | side    | outcome                                                    |
      | inside  | accepted                                                   |
      | outside | refused with status 422 and error "beyond_booking_horizon" |

  @negative @AC-APPT-001.5
  Scenario: A time that has already started cannot be booked
    Given a synthetic "Pediatrics" provider offers a time that started 60 minutes ago
    When the member tries to book that time through the API with a synthetic reason for visit
    Then the booking request is refused with status 422 and error "slot_in_past"

  @boundary @AC-APPT-003.2
  Scenario Outline: Cancellation cutoff
    Given a synthetic "Family Medicine" provider offers a time 5 minutes <side> the cancellation cutoff
    And the first time of that provider has been booked through the API
    When the member tries to cancel that appointment through the API
    Then the cancellation request is <outcome>

    Examples:
      | side    | outcome                                                        |
      | inside  | refused with status 422 and error "cancellation_window_closed" |
      | outside | accepted                                                       |

  @negative @AC-APPT-003.3
  Scenario: A cancelled appointment cannot be cancelled again
    Given a synthetic "Family Medicine" provider offers 1 time
    And the first time of that provider has been booked through the API
    And that appointment has been cancelled through the API
    When the member tries to cancel that appointment through the API
    Then the cancellation request is refused with status 409 and error "already_cancelled"
