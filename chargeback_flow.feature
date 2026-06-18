Feature: Visa Chargeback Dispute Management Workflow for Merchant, Admin, and Partner Portals
  As a portal user (Merchant, Admin, or Partner)
  I want to access my respective portal features, view dashboards, filter datasets, manage dispute lifecycles, and perform actions
  So that chargebacks are systematically handled and audited between all portals.

  Background:
    Given the Chargeback system is running
    And the following portals are available: Merchant Portal, Admin Portal, and Partner Portal

  # ═════════════════════════════════════════════════════════════════════════
  # MERCHANT PORTAL
  # ═════════════════════════════════════════════════════════════════════════

  # --- Dashboard Features ---
  Scenario: Merchant views dashboard analytics and profile
    Given I am logged into the Merchant Portal
    Then I should see the welcome message "Welcome, Merchant Dispute Dashboard 👋"
    And I should see four live statistics cards:
      | Card | Total Disputes |
      | Card | Action Required |
      | Card | Disputes Won |
      | Card | TAT Expired |
    And I should see the dynamic distribution charts for Provider and Status

  Scenario: Merchant filters dashboard stats by preset date range
    Given I am logged into the Merchant Portal
    When I select the date preset "7days"
    Then the dashboard statistics should filter to show data from the last 7 days
    When I select the date preset "custom" and enter custom start and end dates
    Then the dashboard statistics should update according to the custom date range

  # --- Navigation & Sidebar Layout ---
  Scenario: Sidebar collapses and hides menu links on case detail preview
    Given I am logged into the Merchant Portal
    And I am on the Dispute Management page
    When I select a dispute case to view its details
    Then the sidebar should transition to the collapsed state
    And the menu options "Dashboard", "Dispute Management", and "FAQ & Help" should be hidden
    When I click the close button on the preview pane or click the active SLA card to reset
    Then the sidebar should expand to its normal width
    And the menu options should be visible again

  # --- Dispute Management Tabs & Statistics ---
  Scenario: Merchant navigates tabs and views count badges
    Given I am logged into the Merchant Portal
    When I go to the Dispute Management page
    Then I should see four tabs: "Action Required", "Under Review", "Closed", and "All Disputes"
    And the "Action Required" tab should display its dispute count in a badge
    And the "Under Review" tab should display its dispute count in a badge

  Scenario: Merchant filters disputes via SLA summary cards
    Given I am logged into the Merchant Portal
    And I am on the "Action Required" tab showing five SLA summary cards:
      | Card | Due Today |
      | Card | Due Tomorrow |
      | Card | Due 2 to 7 Days |
      | Card | Due after 7 Days |
      | Card | Insufficient Evidence |
    When I click on the "Due Today" SLA summary card
    Then the disputes table should filter to show only cases due today
    And the cards row should freeze sticky at the top of the container
    And the viewport should scroll smoothly down to the reports table section

  Scenario: Merchant views Closed tab analytics
    Given I am logged into the Merchant Portal
    When I click on the "Closed" tab
    Then the summary cards section should show four closed statistics cards:
      | Card | Total Disputes |
      | Card | Won Disputes |
      | Card | Lost Disputes |
      | Card | Representment Win Ratio |

  # --- Filters & Search ---
  Scenario: Merchant filters and searches the disputes list
    Given I am logged into the Merchant Portal
    When I select provider filter "VISA"
    And I select dispute type filter "Pre-Arbitration"
    And I enter "RRN" search criteria as "609315"
    Then the table should only show Visa Pre-Arbitration disputes containing RRN "609315"

  Scenario: Merchant exports filtered disputes to CSV
    Given I am logged into the Merchant Portal
    And I have filtered disputes by provider "VISA" and date range
    When I click the "Export" button in the toolbar
    Then a CSV file containing only the filtered Visa disputes should be downloaded

  # --- Dispute Case Preview & Actions ---
  Scenario: Merchant reviews selected case details split layout
    Given I am logged into the Merchant Portal
    When I click on a dispute case to view details
    Then a split vertical preview pane should slide in from the right
    And the header should show the transaction amount as "Dispute Amount: <amount>"
    And the red SLA pending days label (e.g. "SLA: <days> days pending") should display directly below the amount
    And the SLA text size should be 17px and weight 800, which is larger than the dispute amount text size
    And the body of the pane should show a split layout:
      | Left Column | Action buttons (Accept/Contest), Uploaded documents list, and Case Timeline |
      | Right Column | Transaction details, Dispute info, and Beneficiary/Remitter details |

  Scenario: Merchant accepts liability for a dispute (Accept Loss)
    Given I am logged into the Merchant Portal
    And I have selected an active dispute case in the preview pane
    When I click the "Accept Liability" button
    And I select response type and enter acceptance remarks
    And I click "Submit Acceptance"
    Then the dispute status should change to "Merchant_Accepted"
    And the dispute should close and move to the Closed tab
    And a timeline entry for merchant acceptance should be logged

  Scenario: Merchant contests a dispute and uploads evidence
    Given I am logged into the Merchant Portal
    And I have selected an active dispute case in the preview pane that has no documents uploaded
    When I click the "Contest & Submit Proof" button
    And I upload supporting files (PDF, JPEG, or PNG formats up to 20MB)
    And I enter remarks in the textbox
    And I click "Submit Evidence"
    Then the dispute status should change to "Representment_Submitted"
    And the dispute should move to the "Under Review" tab
    And the uploaded documents should list in the left column evidence list
    And a timeline entry for evidence submission should be logged

  Scenario: Merchant uploads more evidence for an under-review dispute
    Given I am logged into the Merchant Portal
    And I have selected a dispute case that already has uploaded documents
    Then the Accept and Contest actions should be replaced by a single "Upload More Evidence" button
    When I click "Upload More Evidence"
    And I attach additional files and submit
    Then the new files should be appended to the documents list

  Scenario: Merchant adds comments to case timeline
    Given I am logged into the Merchant Portal
    And I have selected a dispute case in the preview pane
    When I click the "Comment" icon button
    And I enter comment text in the dialog and submit
    Then a comment entry with my username and timestamp should append to the case timeline

  # --- Under Review Inline Actions & Tooltips ---
  Scenario: Merchant triggers inline row actions under the Under Review tab
    Given I am logged into the Merchant Portal
    When I switch to the "Under Review" tab
    Then each dispute row in the table should render inline action buttons: Upload ("📤") and Comment ("💬")
    When I hover over the Upload icon
    Then a custom centered dark tooltip "Upload More Evidence" should appear above the icon
    When I hover over the Comment icon
    Then a custom centered dark tooltip "Comment" should appear above the icon
    When I click the inline Comment icon
    Then the case row should automatically get selected and the Comment modal should open

  # --- Guided Website Tour ---
  Scenario: Merchant starts interactive guided portal tour
    Given I am logged into the Merchant Portal
    When I click my profile dropdown in the header
    And I click "Start Guided Tour 🚀"
    Then a step-by-step floating presentation tour with dark backdrop masks should open
    And I can navigate through steps highlighting different parts of the portal (Profile, Sidebar, Tabs, Tables)
    And the system automatically transitions between "Dashboard" and "Dispute Management" pages as I step through

  # --- FAQ Floating Help ---
  Scenario: Merchant opens FAQ floating widget
    Given I am logged into the Merchant Portal
    When I click the "FAQ & Help" sidebar item or the "?" floating button in the bottom-right corner
    Then a fixed floating FAQ card should open in the bottom-right corner of the page
    And the background content should remain visible and fully interactive
    When I navigate to the "Dashboard"
    Then the floating FAQ widget should automatically close

  # ═════════════════════════════════════════════════════════════════════════
  # ADMIN PORTAL
  # ═════════════════════════════════════════════════════════════════════════

  # --- Dashboard & Sidebar navigation ---
  Scenario: Admin views portfolio metrics and navigates sections
    Given I am logged into the Admin Portal
    Then I should see aggregate portfolio stats: Total Disputes, Pending Admin Review, Awaiting Merchant Evidence, Total Won, and Total Lost
    And I should see distribution charts for Dispute Status and Provider
    And I can navigate between sidebar links: "Dashboard", "Dispute Queue", and "VROL Import"

  # --- Dispute Queue Tabs & Details ---
  Scenario: Admin reviews dispute queue tabs and count brackets
    Given I am logged into the Admin Portal
    When I open the "Dispute Queue" page
    Then I should see four queue tabs: "Action Required", "Under Review", "Closed", and "All Disputes"
    And each tab label should display its count in brackets, e.g. "Action Required (count)"
    When I click a dispute case from the queue list
    Then the split vertical details preview panel should slide in from the right

  # --- Dispute Actions ---
  Scenario: Admin approves merchant representment evidence
    Given I am logged into the Admin Portal
    And I am viewing a dispute under review with merchant evidence in the preview pane
    When I click the "Approve Representment" button
    Then the dispute status should update to "Dispute Won"
    And a timeline entry for admin approval should be logged
    And the dispute should move to the Closed tab

  Scenario: Admin declines merchant representment evidence
    Given I am logged into the Admin Portal
    And I am viewing a dispute under review in the preview pane
    When I click the "Decline Representment" button
    And I enter the mandatory rejection remarks explaining the deficiency
    And I click "Submit Decline"
    Then the dispute status should update to "Document Rejected"
    And the case should return to the Merchant's "Action Required" queue
    And a timeline entry with rejection remarks should be logged

  Scenario: Admin escalates dispute to Pre-Arbitration or Arbitration
    Given I am logged into the Admin Portal
    And I am viewing an active dispute case
    When I click "Raise Pre-Arbitration" or "File Arbitration" based on current stage
    Then the dispute status should update to the next dispute stage ("Pre_Arbitration_Filed" or "Arbitration_Filed")
    And the dispute timeline should update

  # --- VROL Import ---
  Scenario: Admin imports VROL dispute batch files
    Given I am logged into the Admin Portal
    When I navigate to the "VROL Import" page
    And I upload a valid Visa VROL XML/CSV batch data file
    Then the new VROL disputes should be parsed, created, and populated in the system database
    And the imported batch record should display in the batch history list

  # --- FAQ Floating Help ---
  Scenario: Admin opens FAQ help widget
    Given I am logged into the Admin Portal
    When I click the circular "?" floating button in the bottom-right corner
    Then the fixed floating FAQ card should open in the bottom-right corner

  # ═════════════════════════════════════════════════════════════════════════
  # PARTNER PORTAL
  # ═════════════════════════════════════════════════════════════════════════

  # --- Dashboard Aggregation ---
  Scenario: Partner views analytics for affiliated merchants
    Given I am logged into the Partner Portal
    When I view the "Portfolio Analytics" page
    Then I should see the aggregated dispute volumes, won/lost ratios, and total values of all my registered merchants
    And I can apply date range presets (Today, 7 days, 30 days, 6 months) to filter the portfolio charts

  # --- Merchant Details ---
  Scenario: Partner views and searches merchant profiles
    Given I am logged into the Partner Portal
    When I click the "Merchant Details" sidebar link
    Then I should see a list of my affiliated merchants displaying their Name, MID, and Status
    And I can use the search bar to filter merchants by MID or name
    When I click "View" on a merchant row
    Then a profile modal opens displaying Merchant Name, MID, TID, Status, Role, Onboarding Date, and Business Information (Business Type, Contact Email, Contact Phone, Address)

  # --- FAQ Floating Help ---
  Scenario: Partner accesses floating FAQ help widget
    Given I am logged into the Partner Portal
    When I click "FAQ & Help" in the sidebar or the "?" button
    Then the floating FAQ widget opens in the bottom-right corner
    And the background analytics dashboard remains visible and interactive
    When I click "Portfolio Analytics"
    Then the floating FAQ widget closes
