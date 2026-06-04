Feature: Visa Chargeback Dispute Management Workflow
  As a user of the Visa Chargeback platform
  I want to be able to raise, track, manage, and resolve chargeback disputes
  So that chargebacks are efficiently handled between Customers, Partners, Merchants, and Issuers/Acquirers.

  Background:
    Given the Chargeback system is running
    And the following portals are available: Customer, Partner, Merchant, and Acquirer/Issuer

  # ---------------------------------------------------------
  # CUSTOMER PORTAL FLOW
  # ---------------------------------------------------------
  Scenario: Customer raises a new dispute
    Given I am logged into the Customer Portal
    When I submit a new chargeback request with valid transaction details
    Then the dispute should be created in the system
    And the status of the dispute should be "Dispute_Received"
    And the dispute should appear in the Merchant's "Action Required" tab

  # ---------------------------------------------------------
  # MERCHANT PORTAL FLOWS (Representment Phase)
  # ---------------------------------------------------------
  Scenario: Merchant reviews a new dispute and uploads evidence
    Given I am logged into the Merchant Portal
    And there is a "Dispute_Received" dispute in the "Action Required" tab
    When I click to view the dispute
    And I click "Upload Evidence"
    And I attach supporting documents and submit
    Then the dispute status should change to "Representment_Submitted"
    And the dispute should move to the Acquirer's queue to forward to the Issuer

  Scenario: Merchant accepts liability for a new dispute
    Given I am logged into the Merchant Portal
    And there is a "Dispute_Received" dispute in the "Action Required" tab
    When I click to view the dispute
    And I click "Accept Loss"
    Then the dispute status should change to "Merchant_Accepted"
    And the dispute should be settled and closed

  Scenario: Merchant reviews Pre-Arbitration and concedes
    Given I am logged into the Merchant Portal
    And the Issuer has filed Pre-Arbitration providing counter-evidence
    When I navigate to the "Documents Pending for Verification" tab
    And I click to view the dispute
    And I click "Accept Issuer Evidence"
    Then the dispute status should change to "Merchant_Accepted_Pre_Arb"
    And the dispute should be closed

  Scenario: Merchant contests Pre-Arbitration with final evidence
    Given I am logged into the Merchant Portal
    And the Issuer has filed Pre-Arbitration
    When I navigate to the "Documents Pending for Verification" tab
    And I click to view the dispute
    And I click "Contest Pre-Arbitration"
    And I provide my final mandatory remarks and evidence
    Then the dispute status should change to "Pre_Arbitration_Response_Submitted"
    And the dispute should move to the Acquirer for final Visa submission

  # ---------------------------------------------------------
  # ISSUER / ACQUIRER PORTAL FLOWS (Pre-Arbitration Phase)
  # ---------------------------------------------------------
  Scenario: Issuer reviews merchant evidence and files Pre-Arbitration
    Given I am logged into the Issuer/Acquirer Portal
    And there is a dispute with "Representment_Submitted" status
    When I click to view the dispute
    And I click "File Pre-Arbitration"
    And I provide counter-evidence and certify cardholder contact
    And I enter mandatory rejection remarks and submit
    Then the dispute status should change to "Pre_Arbitration_Filed"
    And the dispute should appear in the Merchant's "Action Required" tab for final response

  Scenario: Issuer escalates unresolved Pre-Arbitration to Visa Arbitration
    Given I am logged into the Issuer/Acquirer Portal
    And I am viewing a dispute in "Pre_Arbitration_Response_Submitted" state
    When I click "File Arbitration"
    Then the dispute status should change to "Arbitration_Filed"
    And the dispute should be flagged for final Visa network ruling

  Scenario: Visa makes final decision and triggers Settlement Adjustment
    Given the dispute status is "Arbitration_Filed"
    When Visa issues a ruling
    Then the status should transition to "Visa_Decision"
    And finally to "Settlement_Completed" with funds adjusted accordingly

  # ---------------------------------------------------------
  # PARTNER PORTAL FLOWS
  # ---------------------------------------------------------
  Scenario: Partner manages disputes for their merchants
    Given I am logged into the Partner Portal
    When I navigate to the disputes dashboard
    Then I should see all disputes associated with my merchants
    And I can perform bulk uploads to create multiple disputes at once
