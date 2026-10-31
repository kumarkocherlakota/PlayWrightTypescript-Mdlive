@healthcare @ui @api-setup @REQ-PROV-001
Feature: Find a provider in the patient portal
  As a member
  I want to find a provider and see when they are available
  So that I can choose a suitable appointment time

  Each scenario seeds its own uniquely named synthetic provider through the test-support API,
  so results are not affected by other scenarios running in parallel.

  Background:
    Given the member is signed in to the patient portal

  @smoke @positive @AC-PROV-001.1
  Scenario: Searching by name shows the provider with its available times
    Given a synthetic "Cardiology" provider offers 2 times
    When the member searches the portal for that provider by name
    Then the result shows the provider's specialty, location and both times

  @negative @AC-PROV-001.4
  Scenario: A search without matches says so
    When the member searches the portal for a provider name that does not exist
    Then the provider search announces "No providers match your search."

  @positive @AC-PROV-001.5
  Scenario: A time that is already booked is not offered
    Given a synthetic "Family Medicine" provider offers 2 times
    And the first time of that provider has been booked through the API
    When the member searches the portal for that provider by name
    Then the result offers only the second time
