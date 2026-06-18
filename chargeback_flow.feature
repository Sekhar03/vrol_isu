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
    And I click "Contest / Submit Evidence" in the preview split pane
    And I attach supporting documents and submit
    Then the dispute status should change to "Representment_Submitted"
    And the dispute should move to the Acquirer's queue to forward to the Issuer

  Scenario: Merchant accepts liability for a new dispute
    Given I am logged into the Merchant Portal
    And there is a "Dispute_Received" dispute in the "Action Required" tab
    When I click to view the dispute
    And I click "Accept Liability" in the preview split pane
    Then the dispute status should change to "Merchant_Accepted"
    And the dispute should be settled and closed

  Scenario: Merchant reviews Pre-Arbitration and concedes
    Given I am logged into the Merchant Portal
    And the Issuer has filed Pre-Arbitration providing counter-evidence
    When I navigate to the "Under Review" tab
    And I click to view the dispute
    And I click "Accept Issuer Evidence"
    Then the dispute status should change to "Merchant_Accepted_Pre_Arb"
    And the dispute should be closed

  Scenario: Merchant contests Pre-Arbitration with final evidence
    Given I am logged into the Merchant Portal
    And the Issuer has filed Pre-Arbitration
    When I navigate to the "Under Review" tab
    And I click to view the dispute
    And I click "Contest Pre-Arbitration"
    And I provide my final mandatory remarks and evidence
    Then the dispute status should change to "Pre_Arbitration_Response_Submitted"
    And the dispute should move to the Acquirer for final Visa submission

  # ---------------------------------------------------------
  # NEW ENHANCED MERCHANT PORTAL FLOWS
  # ---------------------------------------------------------
  Scenario: Sidebar collapses and hides navigation on case selection
    Given I am logged into the Merchant Portal
    When I click to view a dispute case from the list
    Then the sidebar should transition to collapsed state
    And the navigation items "Dashboard", "Dispute Management", and "FAQ & Help" should be hidden
    When I click the SLA card or deselect the active case
    Then the sidebar should expand back to normal state
    And the navigation items should be visible again

  Scenario: Help links toggle non-blocking floating FAQ widget
    Given I am logged into the Merchant Portal
    When I click the "FAQ & Help" sidebar item or the "?" floating button in the bottom-right corner
    Then a floating FAQ widget should open in the lower-right corner of the viewport
    And the background dashboard or reports content should remain fully visible and interactive
    When I click on other pages like "Dashboard" or "Dispute Management"
    Then the floating FAQ widget should close

  Scenario: SLA Card click filters list and scrolls smoothly to table section
    Given I am logged into the Merchant Portal
    And I am on the "Action Required" tab showing SLA summary cards
    When I click on the "Due Today" SLA card
    Then the disputes table should filter to only display cases due today
    And the active tab should remain "Action Required"
    And the viewport should scroll smoothly to the table container section
    And the summary cards row should remain frozen sticky at the top of the container

  Scenario: Selected case preview displays split layout and prominent SLA
    Given I am logged into the Merchant Portal
    When I click to view a dispute case details preview
    Then the split vertical preview pane should slide in from the right
    And the header should display the dispute amount and the SLA remaining days in red
    And the SLA days pending text size should be larger than the dispute amount text size
    And the preview pane body should show a split layout:
      | Left Column | Contest/Accept buttons, Evidence documents list, and Timeline |
      | Right Column | Transaction details, Dispute info, and cardholder info |

  Scenario: Under Review tab inline row actions and tooltips
    Given I am logged into the Merchant Portal
    When I switch to the "Under Review" tab
    Then every dispute row in the table should show inline action buttons for Upload ("📤") and Comment ("💬")
    When I hover the mouse over the Upload button
    Then a custom centered dark tooltip displaying "Upload More Evidence" should appear above the button
    When I click the inline Comment button
    Then the corresponding dispute case should get selected and the Comment modal should open

  Scenario: Closed tab displays four statistics cards
    Given I am logged into the Merchant Portal
    When I click on the "Closed" tab
    Then I should see a statistics header displaying four cards:
      | Card 1 | Total Disputes |
      | Card 2 | Won Disputes |
      | Card 3 | Lost Disputes |
      | Card 4 | Representment Win Ratio |

  Scenario: Exporting filtered dispute list as CSV
    Given I am logged into the Merchant Portal
    And I have filtered disputes by date, search query, or status preset
    When I click the "Export" button in the toolbar
    Then the downloaded CSV file should contain only the filtered subset of disputes

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
  Scenario: Partner manages disputes and uses floating help widget
    Given I am logged into the Partner Portal
    When I navigate to the disputes dashboard
    Then I should see all disputes associated with my merchants
    And I can perform bulk uploads to create multiple disputes at once
    When I click the "FAQ & Help" sidebar item or the "?" floating button
    Then the floating FAQ widget should open in the lower-right corner
    And the background analytics dashboard should remain fully visible and interactive
