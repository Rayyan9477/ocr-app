#!/usr/bin/env python3
import matplotlib.pyplot as plt
import matplotlib.patches as patches
from matplotlib.backends.backend_pdf import PdfPages
import numpy as np

def create_multipage_test_pdf():
    """Create a 3-page PDF with different content on each page for testing"""
    
    with PdfPages('test_3page.pdf') as pdf:
        # Page 1: Medical Bill Header
        fig, ax = plt.subplots(figsize=(8.5, 11))
        ax.text(0.5, 0.9, 'MEDICAL BILL - PAGE 1', ha='center', va='center', 
                fontsize=20, weight='bold', transform=ax.transAxes)
        
        # Add some medical-like content
        content_page1 = [
            "Patient: John Doe",
            "Date of Service: 2024-01-15", 
            "Provider: City Medical Center",
            "Invoice #: INV-2024-001",
            "",
            "SERVICES PROVIDED:",
            "Office Visit - 99213           $150.00",
            "Lab Work - 80053              $45.00", 
            "X-Ray - 73060                 $85.00",
            "",
            "TOTAL CHARGES:               $280.00"
        ]
        
        y_pos = 0.75
        for line in content_page1:
            ax.text(0.1, y_pos, line, fontsize=12, transform=ax.transAxes)
            y_pos -= 0.05
            
        ax.set_xlim(0, 1)
        ax.set_ylim(0, 1)
        ax.axis('off')
        pdf.savefig(fig, bbox_inches='tight')
        plt.close()
        
        # Page 2: Detailed Breakdown
        fig, ax = plt.subplots(figsize=(8.5, 11))
        ax.text(0.5, 0.9, 'DETAILED BREAKDOWN - PAGE 2', ha='center', va='center',
                fontsize=20, weight='bold', transform=ax.transAxes)
        
        content_page2 = [
            "PROCEDURE CODES:",
            "CPT 99213 - Office Visit Level 3",
            "CPT 80053 - Comprehensive Metabolic Panel", 
            "CPT 73060 - Knee X-Ray, 2 Views",
            "",
            "DIAGNOSIS CODES:",
            "ICD-10 M25.561 - Pain in right knee",
            "ICD-10 Z00.00 - General health exam",
            "",
            "INSURANCE INFORMATION:",
            "Primary: Blue Cross Blue Shield",
            "Policy #: BC123456789",
            "Claim #: CL2024-0015"
        ]
        
        y_pos = 0.75
        for line in content_page2:
            ax.text(0.1, y_pos, line, fontsize=12, transform=ax.transAxes)
            y_pos -= 0.05
            
        ax.set_xlim(0, 1)
        ax.set_ylim(0, 1)
        ax.axis('off')
        pdf.savefig(fig, bbox_inches='tight')
        plt.close()
        
        # Page 3: Payment Information
        fig, ax = plt.subplots(figsize=(8.5, 11))
        ax.text(0.5, 0.9, 'PAYMENT SUMMARY - PAGE 3', ha='center', va='center',
                fontsize=20, weight='bold', transform=ax.transAxes)
        
        content_page3 = [
            "BILLING SUMMARY:",
            "Total Charges:               $280.00",
            "Insurance Payment:           $224.00",
            "Patient Responsibility:       $56.00",
            "",
            "PAYMENT DUE:",
            "Amount Due:                   $56.00",
            "Due Date: 2024-02-15",
            "",
            "PROVIDER CONTACT:",
            "City Medical Center",
            "123 Health Street",
            "Medical City, MC 12345",
            "Phone: (555) 123-4567"
        ]
        
        y_pos = 0.75
        for line in content_page3:
            ax.text(0.1, y_pos, line, fontsize=12, transform=ax.transAxes)
            y_pos -= 0.05
            
        ax.set_xlim(0, 1)
        ax.set_ylim(0, 1)
        ax.axis('off')
        pdf.savefig(fig, bbox_inches='tight')
        plt.close()
    
    print("Created test_3page.pdf with 3 pages")

if __name__ == "__main__":
    create_multipage_test_pdf()
