# VLM Integration Tests

This document explains how to run the tests for validating the VLM (Vision Language Model) integration with the OCR system.

## Overview

The test suite consists of three main components:

1. **Component Tests**: Unit tests for the VLM-enhanced components
2. **API Tests**: Integration tests for the Smart OCR API with VLM
3. **Integration Tests**: End-to-end tests for the VLM-enhanced OCR system

## Prerequisites

Before running the tests, ensure you have the following:

1. A running OCR application (local or deployed)
2. Node.js and npm installed
3. Test files: `test_handwritten.png`, `test_page-01.jpg`, and `test-file.pdf` in the project root

## Running the Tests

### All Tests

To run all tests at once, use:

```bash
npm run test:vlm
```

This will:
1. Check if the server is running (and start it if not)
2. Verify VLM availability
3. Run component tests
4. Run API tests
5. Run integration tests
6. Generate a comprehensive report

### Individual Test Suites

You can also run specific test suites:

```bash
# For component tests only
npm run test:vlm:components

# For API tests only
npm run test:vlm:api

# For integration tests only
npm run test:vlm:integration
```

## Test Reports

After running the tests, you'll find detailed reports in the `test-results` directory:

- `component-tests.log`: Results from component unit tests
- `api-tests.log`: Results from API integration tests
- `integration-tests.log`: Results from end-to-end tests
- `vlm-integration-results.log`: Detailed test results
- `vlm-ocr-final-report.md`: Comprehensive report with analysis and recommendations

## Testing in Different Environments

### Testing with VLM Available

When the VLM service is available, the tests will validate:
- Document analysis using VLM
- Engine selection based on VLM recommendations
- Post-processing enhancement with VLM
- Confidence scoring with VLM

### Testing with VLM Unavailable (Fallback Mode)

Even when the VLM service is unavailable, the tests will verify:
- Graceful fallback to standard document analysis
- Fallback engine selection
- Basic OCR processing without VLM enhancements
- Standard confidence scoring

This ensures the system remains functional even when VLM services are down.

## Performance Considerations

The integration tests include performance measurements to evaluate the impact of VLM integration:

- Processing time with VLM vs. without VLM
- Memory usage
- Overall system responsiveness

These metrics help determine if the VLM integration meets performance requirements.

## Troubleshooting

If tests fail, check:

1. **Server Status**: Ensure the OCR server is running
2. **VLM Availability**: Check if the VLM service is accessible
3. **Test Files**: Verify that test files exist in the correct locations
4. **Dependencies**: Ensure all required packages are installed

## Adding New Tests

When adding new VLM features, extend the test suite by:

1. Adding new unit tests to `test-vlm-ocr.js`
2. Adding new API tests to `test-vlm-api.js`
3. Adding new integration scenarios to `test-vlm-integration.js`

Follow the existing patterns to maintain consistency.
