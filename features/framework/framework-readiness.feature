@framework @smoke
Feature: Framework readiness
  As a test engineer
  I want the framework to verify its own runtime guarantees
  So that configuration, data-protection and isolation problems surface before business scenarios run

  @positive
  Scenario: The active configuration is validated and immutable
    Then the active configuration cannot be modified during the run
    And every configured service URL uses HTTP or HTTPS

  @security @positive
  Scenario Outline: Sensitive values are masked in execution logs
    Given a synthetic <value type> is written to the execution log
    Then the execution log does not reveal the synthetic value
    And the execution log shows the value as masked

    Examples:
      | value type    |
      | password      |
      | bearer token  |
      | email address |
      | card number   |

  @negative
  Scenario: Reading scenario state that was never stored fails with a clear error
    When the scenario reads state that was never stored
    Then the framework reports which scenario state is missing

  @ui @positive
  Scenario: Each UI scenario starts with an isolated browser session
    Then the browser session starts without cookies or stored data
