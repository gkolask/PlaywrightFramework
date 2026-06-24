Feature: Example domain
  As a tester
  I want to verify that the example domain page loads correctly
  So that the framework demonstrates Playwright with Cucumber

  Scenario: Verify Example.com home page
    Given I open the example domain
    Then I should see the page title "Example Domain"
    And I should see the main heading "Example Domain"
