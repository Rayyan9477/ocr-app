#!/usr/bin/env node

/**
 * GitHub Actions Workflow Validation Script
 * Validates the azure-deploy.yml workflow file for syntax, structure, and completeness
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

class WorkflowValidator {
  constructor() {
    this.workflowPath = path.join(process.cwd(), '.github/workflows/azure-deploy.yml');
    this.errors = [];
    this.warnings = [];
    this.checks = [];
  }

  /**
   * Main validation function
   */
  async validate() {
    console.log('🔍 GITHUB ACTIONS WORKFLOW VALIDATION');
    console.log('=====================================');
    
    try {
      // Check if workflow file exists
      if (!fs.existsSync(this.workflowPath)) {
        this.addError('Workflow file not found: .github/workflows/azure-deploy.yml');
        return this.reportResults();
      }

      // Read and parse YAML
      const workflowContent = fs.readFileSync(this.workflowPath, 'utf8');
      const workflow = yaml.load(workflowContent);

      // Run validation checks
      this.validateWorkflowStructure(workflow);
      this.validateTriggers(workflow);
      this.validateEnvironmentVariables(workflow);
      this.validateJobs(workflow);
      this.validateSteps(workflow);
      this.validateDeploymentConfiguration(workflow);
      this.validateSecrets(workflow);

      // Check for deployment script
      this.validateDeploymentScript();

      // Check for Azure configuration files
      this.validateAzureConfiguration();

      return this.reportResults();

    } catch (error) {
      this.addError(`YAML parsing error: ${error.message}`);
      return this.reportResults();
    }
  }

  /**
   * Validate basic workflow structure
   */
  validateWorkflowStructure(workflow) {
    const requiredFields = ['name', 'on', 'jobs'];
    
    requiredFields.forEach(field => {
      if (!workflow[field]) {
        this.addError(`Missing required field: ${field}`);
      } else {
        this.addCheck(`✅ Required field '${field}' present`);
      }
    });

    // Check workflow name
    if (workflow.name && workflow.name.includes('OCR App')) {
      this.addCheck('✅ Workflow name is descriptive');
    }
  }

  /**
   * Validate trigger configuration
   */
  validateTriggers(workflow) {
    const triggers = workflow.on;
    
    if (!triggers) {
      this.addError('No triggers defined');
      return;
    }

    // Check for push trigger
    if (triggers.push) {
      if (triggers.push.branches && triggers.push.branches.includes('main')) {
        this.addCheck('✅ Push trigger configured for main branch');
      }
      if (triggers.push.branches && triggers.push.branches.includes('recovered-changes')) {
        this.addCheck('✅ Push trigger configured for recovered-changes branch');
      }
    }

    // Check for manual trigger
    if (triggers.workflow_dispatch) {
      this.addCheck('✅ Manual workflow dispatch enabled');
    }
  }

  /**
   * Validate environment variables
   */
  validateEnvironmentVariables(workflow) {
    const env = workflow.env;
    
    if (!env) {
      this.addWarning('No environment variables defined');
      return;
    }

    const requiredEnvVars = ['AZURE_WEBAPP_NAME', 'NODE_VERSION'];
    
    requiredEnvVars.forEach(envVar => {
      if (env[envVar]) {
        this.addCheck(`✅ Environment variable '${envVar}' defined`);
      } else {
        this.addError(`Missing environment variable: ${envVar}`);
      }
    });

    // Validate specific values
    if (env.NODE_VERSION && env.NODE_VERSION.includes('20')) {
      this.addCheck('✅ Node.js version 20.x specified');
    }
  }

  /**
   * Validate jobs configuration
   */
  validateJobs(workflow) {
    const jobs = workflow.jobs;
    
    if (!jobs) {
      this.addError('No jobs defined');
      return;
    }

    // Check for main job
    if (jobs['build-and-deploy']) {
      this.addCheck('✅ Main build-and-deploy job present');
      
      const job = jobs['build-and-deploy'];
      
      // Check runner
      if (job['runs-on'] === 'ubuntu-latest') {
        this.addCheck('✅ Using ubuntu-latest runner');
      }
      
      // Check timeout
      if (job['timeout-minutes']) {
        this.addCheck('✅ Job timeout configured');
      }
    }
  }

  /**
   * Validate workflow steps
   */
  validateSteps(workflow) {
    const job = workflow.jobs['build-and-deploy'];
    
    if (!job || !job.steps) {
      this.addError('No steps defined in build-and-deploy job');
      return;
    }

    const steps = job.steps;
    const requiredSteps = [
      'Checkout code',
      'Set up Node.js',
      'Install system dependencies',
      'Clean install dependencies',
      'Build Next.js application',
      'Create optimized deployment package',
      'Deploy to Azure App Service'
    ];

    requiredSteps.forEach(stepName => {
      const stepExists = steps.some(step => 
        step.name && step.name.includes(stepName.split(' ')[0])
      );
      
      if (stepExists) {
        this.addCheck(`✅ Step '${stepName}' present`);
      } else {
        this.addError(`Missing step: ${stepName}`);
      }
    });

    // Check for system dependencies
    const sysDepsStep = steps.find(step => 
      step.name && step.name.includes('system dependencies')
    );
    
    if (sysDepsStep && sysDepsStep.run) {
      if (sysDepsStep.run.includes('tesseract-ocr')) {
        this.addCheck('✅ Tesseract OCR dependency configured');
      }
      if (sysDepsStep.run.includes('ghostscript')) {
        this.addCheck('✅ Ghostscript dependency configured');
      }
    }
  }

  /**
   * Validate deployment configuration
   */
  validateDeploymentConfiguration(workflow) {
    const job = workflow.jobs['build-and-deploy'];
    
    if (!job || !job.steps) return;

    const deployStep = job.steps.find(step => 
      step.name && step.name.includes('Deploy to Azure')
    );

    if (deployStep) {
      this.addCheck('✅ Azure deployment step present');
      
      if (deployStep.uses && deployStep.uses.includes('azure/webapps-deploy')) {
        this.addCheck('✅ Using official Azure deployment action');
      }
      
      if (deployStep.with) {
        const config = deployStep.with;
        
        if (config['app-name']) {
          this.addCheck('✅ App name configured');
        }
        if (config['publish-profile']) {
          this.addCheck('✅ Publish profile configured');
        }
        if (config['package']) {
          this.addCheck('✅ Deployment package configured');
        }
      }
    }
  }

  /**
   * Validate secrets usage
   */
  validateSecrets(workflow) {
    const workflowContent = fs.readFileSync(this.workflowPath, 'utf8');
    
    if (workflowContent.includes('AZUREAPPSERVICE_PUBLISHPROFILE_E7A94C1E72D2413EA5D290FEE494EFFF')) {
      this.addCheck('✅ Azure publish profile secret referenced');
    } else if (workflowContent.includes('AZURE_WEBAPP_PUBLISH_PROFILE')) {
      this.addCheck('✅ Azure publish profile secret referenced');
    } else {
      this.addError('Missing Azure publish profile secret');
    }
  }

  /**
   * Validate deployment script exists
   */
  validateDeploymentScript() {
    const scriptPath = path.join(process.cwd(), 'create-deployment-package-final.sh');
    
    if (fs.existsSync(scriptPath)) {
      this.addCheck('✅ Deployment script exists');
      
      // Check if executable
      const stats = fs.statSync(scriptPath);
      if (stats.mode & parseInt('111', 8)) {
        this.addCheck('✅ Deployment script is executable');
      } else {
        this.addWarning('Deployment script may not be executable');
      }
    } else {
      this.addError('Deployment script not found: create-deployment-package-final.sh');
    }
  }

  /**
   * Validate Azure configuration files
   */
  validateAzureConfiguration() {
    const configFiles = [
      'web.config.production',
      'iisnode.yml',
      'startup.sh'
    ];

    configFiles.forEach(file => {
      const filePath = path.join(process.cwd(), file);
      if (fs.existsSync(filePath)) {
        this.addCheck(`✅ Azure config file '${file}' exists`);
      } else {
        this.addError(`Missing Azure config file: ${file}`);
      }
    });
  }

  /**
   * Add error to validation results
   */
  addError(message) {
    this.errors.push(message);
  }

  /**
   * Add warning to validation results
   */
  addWarning(message) {
    this.warnings.push(message);
  }

  /**
   * Add successful check to validation results
   */
  addCheck(message) {
    this.checks.push(message);
  }

  /**
   * Report validation results
   */
  reportResults() {
    console.log('\n📊 VALIDATION RESULTS');
    console.log('====================');

    // Show successful checks
    if (this.checks.length > 0) {
      console.log('\n✅ PASSED CHECKS:');
      this.checks.forEach(check => console.log(`  ${check}`));
    }

    // Show warnings
    if (this.warnings.length > 0) {
      console.log('\n⚠️  WARNINGS:');
      this.warnings.forEach(warning => console.log(`  ⚠️  ${warning}`));
    }

    // Show errors
    if (this.errors.length > 0) {
      console.log('\n❌ ERRORS:');
      this.errors.forEach(error => console.log(`  ❌ ${error}`));
    }

    // Summary
    console.log('\n📈 SUMMARY');
    console.log('==========');
    console.log(`✅ Passed: ${this.checks.length}`);
    console.log(`⚠️  Warnings: ${this.warnings.length}`);
    console.log(`❌ Errors: ${this.errors.length}`);

    const success = this.errors.length === 0;
    
    if (success) {
      console.log('\n🎉 VALIDATION SUCCESSFUL!');
      console.log('✅ GitHub Actions workflow is ready for deployment!');
    } else {
      console.log('\n❌ VALIDATION FAILED!');
      console.log('Please fix the errors above before deploying.');
    }

    return success;
  }
}

// Run validation if called directly
if (require.main === module) {
  const validator = new WorkflowValidator();
  validator.validate()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Validation failed:', error);
      process.exit(1);
    });
}

module.exports = WorkflowValidator;
