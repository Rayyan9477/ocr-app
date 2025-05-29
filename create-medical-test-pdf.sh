#!/bin/bash

# Create a better test PDF with actual medical content
echo "Creating medical bill test PDF..."

# Create a temporary text file with medical content
cat > /tmp/medical_test.txt << 'EOF'
MEDICAL REPORT

Patient: John Smith                    DOB: 01/15/1980
Medical Record #: MR123456             Date of Service: 05/29/2025
Provider: Dr. Sarah Johnson           NPI: 1234567890

DIAGNOSIS:
- Essential Hypertension (I10)
- Type 2 Diabetes Mellitus (E11.9)

PROCEDURES:
- Office Visit, Level 4 (CPT: 99214)
- Blood Pressure Check (CPT: 99401)

VITAL SIGNS:
Blood Pressure: 140/90 mmHg
Pulse: 72 bpm
Temperature: 98.6°F
Weight: 185 lbs

MEDICATIONS:
- Lisinopril 10mg daily
- Metformin 500mg twice daily

BILLING INFORMATION:
Facility: ABC Medical Center
Address: 123 Health St, Medical City, MC 12345
Phone: (555) 123-4567

Total Charges: $285.00
Insurance: Blue Cross Blue Shield
Copay: $25.00
Patient Responsibility: $25.00

PAGE 2

LABORATORY RESULTS

Date: 05/29/2025
Lab Order #: LAB789123

CHEMISTRY PANEL:
- Glucose: 105 mg/dL (Normal: 70-100)
- Cholesterol: 195 mg/dL (Normal: <200)
- HDL: 45 mg/dL (Normal: >40)
- LDL: 125 mg/dL (Normal: <100)
- Triglycerides: 150 mg/dL (Normal: <150)

HbA1c: 7.2% (Target: <7.0%)

RECOMMENDATIONS:
1. Continue current medications
2. Follow up in 3 months
3. Dietary counseling recommended
4. Monitor blood glucose daily

Provider Signature: Dr. Sarah Johnson, MD
Date Signed: 05/29/2025

PAGE 3

INSURANCE CLAIM SUMMARY

Claim #: CLM456789
Submission Date: 05/30/2025
Processing Date: 06/05/2025

SERVICES BILLED:
Date: 05/29/2025
Provider: Dr. Sarah Johnson
Facility: ABC Medical Center

LINE ITEMS:
1. Office Visit (99214) - $185.00 - PAID
2. Blood Pressure Check (99401) - $100.00 - PAID

PAYMENT SUMMARY:
Total Billed: $285.00
Insurance Paid: $228.00
Patient Copay: $25.00
Adjustment: $32.00
Patient Balance: $0.00

REMITTANCE ADVICE:
Check #: 987654321
Check Date: 06/05/2025
Amount: $228.00

This claim has been processed and paid in full.
Contact customer service at 1-800-INSURANCE
for any questions regarding this claim.

Reference #: REF123456789
EOF

# Convert to PDF using available tools
if command -v pandoc >/dev/null 2>&1; then
    echo "Using pandoc to create PDF..."
    pandoc /tmp/medical_test.txt -o uploads/medical_test_3page.pdf
elif command -v enscript >/dev/null 2>&1 && command -v ps2pdf >/dev/null 2>&1; then
    echo "Using enscript + ps2pdf to create PDF..."
    enscript -p /tmp/medical_test.ps /tmp/medical_test.txt
    ps2pdf /tmp/medical_test.ps uploads/medical_test_3page.pdf
    rm /tmp/medical_test.ps
elif command -v a2ps >/dev/null 2>&1 && command -v ps2pdf >/dev/null 2>&1; then
    echo "Using a2ps + ps2pdf to create PDF..."
    a2ps -o /tmp/medical_test.ps /tmp/medical_test.txt
    ps2pdf /tmp/medical_test.ps uploads/medical_test_3page.pdf
    rm /tmp/medical_test.ps
else
    echo "Creating simple PDF using printf method..."
    # Create a basic PDF with the text content
    {
        echo "%PDF-1.4"
        echo "1 0 obj"
        echo "<<"
        echo "/Type /Catalog"
        echo "/Pages 2 0 R"
        echo ">>"
        echo "endobj"
        echo ""
        echo "2 0 obj"
        echo "<<"
        echo "/Type /Pages"
        echo "/Kids [3 0 R]"
        echo "/Count 1"
        echo ">>"
        echo "endobj"
        echo ""
        echo "3 0 obj"
        echo "<<"
        echo "/Type /Page"
        echo "/Parent 2 0 R"
        echo "/MediaBox [0 0 612 792]"
        echo "/Contents 4 0 R"
        echo "/Resources 5 0 R"
        echo ">>"
        echo "endobj"
        echo ""
        echo "4 0 obj"
        echo "<<"
        echo "/Length 200"
        echo ">>"
        echo "stream"
        echo "BT"
        echo "/F1 12 Tf"
        echo "50 750 Td"
        echo "(MEDICAL REPORT - Patient: John Smith) Tj"
        echo "0 -20 Td"
        echo "(DOB: 01/15/1980 - Date of Service: 05/29/2025) Tj"
        echo "0 -20 Td"
        echo "(Diagnosis: Essential Hypertension, Type 2 Diabetes) Tj"
        echo "0 -20 Td"
        echo "(CPT Codes: 99214, 99401) Tj"
        echo "ET"
        echo "endstream"
        echo "endobj"
        echo ""
        echo "5 0 obj"
        echo "<<"
        echo "/Font <<"
        echo "/F1 <<"
        echo "/Type /Font"
        echo "/Subtype /Type1"
        echo "/BaseFont /Helvetica"
        echo ">>"
        echo ">>"
        echo ">>"
        echo "endobj"
        echo ""
        echo "xref"
        echo "0 6"
        echo "0000000000 65535 f "
        echo "0000000009 00000 n "
        echo "0000000074 00000 n "
        echo "0000000120 00000 n "
        echo "0000000216 00000 n "
        echo "0000000463 00000 n "
        echo "trailer"
        echo "<<"
        echo "/Size 6"
        echo "/Root 1 0 R"
        echo ">>"
        echo "startxref"
        echo "559"
        echo "%%EOF"
    } > uploads/medical_test_3page.pdf
fi

# Clean up
rm /tmp/medical_test.txt

echo "Medical test PDF created: uploads/medical_test_3page.pdf"
ls -la uploads/medical_test_3page.pdf
