#!/bin/bash

# Create a 3-page PDF using wkhtmltopdf
cat > temp_page1.html << 'HTML1'
<!DOCTYPE html>
<html>
<head><title>Medical Records - Page 1</title></head>
<body style="font-family: Arial; padding: 50px;">
<h1>Medical Records Summary</h1>
<p><strong>Patient:</strong> John Doe</p>
<p><strong>Date of Visit:</strong> 2024-01-15</p>
<p><strong>Chief Complaint:</strong> Annual checkup</p>
<h2>Vital Signs:</h2>
<ul>
<li>Blood Pressure: 120/80 mmHg</li>
<li>Temperature: 98.6°F</li>
<li>Heart Rate: 72 bpm</li>
<li>Weight: 175 lbs</li>
<li>Height: 5'10"</li>
</ul>
<p>Patient appears in good health for routine examination.</p>
</body>
</html>
HTML1

cat > temp_page2.html << 'HTML2'
<!DOCTYPE html>
<html>
<head><title>Medical Records - Page 2</title></head>
<body style="font-family: Arial; padding: 50px;">
<h1>Examination Results</h1>
<h2>Physical Examination:</h2>
<ul>
<li>General appearance: Well-developed</li>
<li>HEENT: Normal</li>
<li>Cardiovascular: Regular rhythm</li>
<li>Respiratory: Clear to auscultation</li>
<li>Abdomen: Soft, non-tender</li>
</ul>
<h2>Laboratory Results:</h2>
<ul>
<li>Complete Blood Count: Within normal limits</li>
<li>Cholesterol: 180 mg/dL</li>
<li>Glucose: 95 mg/dL</li>
</ul>
</body>
</html>
HTML2

cat > temp_page3.html << 'HTML3'
<!DOCTYPE html>
<html>
<head><title>Medical Records - Page 3</title></head>
<body style="font-family: Arial; padding: 50px;">
<h1>Treatment Plan</h1>
<h2>Recommendations:</h2>
<ul>
<li>Continue current medications</li>
<li>Follow up in 6 months</li>
<li>Annual screening labs</li>
<li>Maintain healthy diet and exercise</li>
</ul>
<h2>Medications:</h2>
<ul>
<li>Lisinopril 10mg daily</li>
<li>Metformin 500mg twice daily</li>
</ul>
<p><strong>Provider:</strong> Dr. Smith, MD</p>
<p><strong>Next Appointment:</strong> July 15, 2024</p>
</body>
</html>
HTML3

# Create individual PDFs
wkhtmltopdf temp_page1.html page1.pdf
wkhtmltopdf temp_page2.html page2.pdf  
wkhtmltopdf temp_page3.html page3.pdf

# Combine into single 3-page PDF
pdftk page1.pdf page2.pdf page3.pdf cat output uploads/test_3page.pdf

# Cleanup
rm temp_page*.html page*.pdf

echo "Created 3-page test PDF: uploads/test_3page.pdf"
