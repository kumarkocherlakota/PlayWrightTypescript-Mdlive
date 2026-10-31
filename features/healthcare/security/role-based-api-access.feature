@healthcare @api @REQ-AUTH-003
Feature: Role-based API access
  As the operator of the healthcare APIs
  I want each caller limited to the capabilities of its role
  So that a service integration cannot read or change member appointments

  The service client is the configured OAuth 2.0 client (API_CLIENT_ID). Its role, directory
  access only, is a fixture rule of the reference identity provider (C-12).

  Background:
    Given a synthetic "Family Medicine" provider offers 1 time

  @security @AC-AUTH-003.1
  Scenario Outline: The service client may search the directory but not use appointments
    When the service client sends a <request> request
    Then the <request> request is <outcome>

    Examples:
      | request          | outcome                                                 |
      | directory        | accepted                                                |
      | appointment list | refused with status 403 and error "insufficient_scope" |
      | booking          | refused with status 403 and error "insufficient_scope" |
