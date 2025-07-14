const { DefaultAzureCredential } = require("@azure/identity");
const { WebSiteManagementClient } = require("@azure/arm-appservice");
const { ResourceManagementClient } = require("@azure/arm-resources");

const subscriptionId = process.env.AZURE_SUBSCRIPTION_ID;
const resourceGroupName = "ocr-app-rg";
const webAppName = "ocr-app-service";
const location = "eastus";

async function main() {
  try {
    const credential = new DefaultAzureCredential();
    
    // Create Resource Management Client
    const resourceClient = new ResourceManagementClient(credential, subscriptionId);
    
    // Create Resource Group
    console.log("Creating resource group...");
    await resourceClient.resourceGroups.createOrUpdate(resourceGroupName, {
      location: location,
    });

    // Create Web App Management Client
    const webClient = new WebSiteManagementClient(credential, subscriptionId);

    // Create App Service Plan
    console.log("Creating app service plan...");
    const planName = `${webAppName}-plan`;
    await webClient.appServicePlans.beginCreateOrUpdateAndWait(
      resourceGroupName,
      planName,
      {
        location: location,
        sku: {
          name: "B1",
          tier: "Basic",
        },
      }
    );

    // Create Web App
    console.log("Creating web app...");
    await webClient.webApps.beginCreateOrUpdateAndWait(
      resourceGroupName,
      webAppName,
      {
        location: location,
        serverFarmId: `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.Web/serverfarms/${planName}`,
        siteConfig: {
          linuxFxVersion: "NODE|20-lts",
          appSettings: [
            {
              name: "WEBSITE_NODE_DEFAULT_VERSION",
              value: "~20",
            },
            {
              name: "SCM_DO_BUILD_DURING_DEPLOYMENT",
              value: "true",
            },
          ],
        },
      }
    );

    console.log(`Web App created: https://${webAppName}.azurewebsites.net`);
    return webAppName;
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

main().catch(console.error);
