@healthcare @api @REQ-PROV-001
Feature: Provider directory API
  As the patient portal
  I want to query the provider directory
  So that members can find providers and their available times

  @positive @AC-PROV-001.2
  Scenario Outline: Filtering by specialty returns only that specialty
    Given a synthetic "<specialty>" provider offers 1 time
    When the directory is searched for "<specialty>" providers
    Then every provider returned is a "<specialty>" provider
    And the synthetic provider is among them

    Examples:
      | specialty  |
      | Cardiology |
      | Pediatrics |

  @negative @AC-PROV-001.3
  Scenario: An unknown specialty is rejected
    When the directory is searched for "Astrology" providers
    Then the directory request is rejected because "specialty" is invalid

  @positive @AC-PROV-001.5
  Scenario: A booked time is reported as unavailable
    Given a synthetic "Dermatology" provider offers 2 times
    And the first time of that provider has been booked through the API
    Then the directory reports the first time as unavailable and the second as available

  @security @AC-PROV-001.6
  Scenario Outline: The directory refuses callers without valid credentials
    When the directory is searched with <credentials>
    Then the directory request is refused with status 401 and error "unauthorized"

    Examples:
      | credentials      |
      | no credentials   |
      | an invalid token |
