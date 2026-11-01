(function(){
"use strict";
globalThis.FepRequestDefaults = Object.freeze({
"survey": {title:"Site Survey", payload:{
        query: `mutation ($project: String!, $surveyDetails: JSON, $stage: Int, $roofDetailsData: [JSON], $electricityDetails: JSON, $media: JSON) {
      saveSurvey (project: $project, surveyDetails: $surveyDetails, stage: $stage, roofDetailsData: $roofDetailsData, electricityDetails: $electricityDetails, media: $media) {
    message
  }
    }`,
        variables: {
          project: "{{projectId}}",
          surveyDetails: {
            dateOfSurvey: "2025-06-17",
            siteSurveyBy: "699c1a3c197c74dadc556b36",
            surveyMobileNumber: "6546565655",
            surveyName: "test site eng",
            surveyEmail: "testtilicho_se@tilicho.in",
            customerName: "Testing sridhar warr 06-07-2026",
            projectSize: { projectSize: "{{projectSize}}" },
            customerMobileNumber: "7997714333",
            customerEmail: "csssrh@freyr.in",
            customerAddress: "Boduvalasa, Visakhapatanam, Anakapalle Division, Andhra Pradesh",
            latitude: "{{latitude}}",
            longitude: "{{longitude}}"
          },
          stage: 4,
          roofDetailsData: [
            {
              roofDetails: "RCC",
              accessToRoofRCC: "Yes",
              isDrillingUpto2InchesAllowedRCC: "Yes",
              slabThicknessRCC: { slabThicknessRCC: 11 },
              parapetWallWidthRCC: { parapetWallWidthRCC: 1 },
              parapetWallheightRCC: { parapetWallheightRCC: 1 },
              isWaterProofileAvailableOnRoofSlabRCC: "Yes",
              metionTheAdjustableOrRemobaleObjectsForInstallationRCC: "11",
              additionalInformationRCC: "11",
              dimensionForEachRoofRCC: [
                { areaName: "11", length: { reading1: 11 }, height: { reading3: 11 }, width: { reading2: 8 } }
              ],
              ageOfTheBuildingRCC: { ageOfTheBuildingRCC: 11 },
              areThereAnyPreExistingWaterLeakagesFromTheRoofRCC: "11",
              distanceOfWaterSourceFromRoofRCC: { distanceOfWaterSourceFromRoofRCC: 11 },
              waterSourceOnRoofRCC: "Yes",
              motorAvailabilityRCC: "Yes"
            }
          ],
          electricityDetails: {
            contractLoadLessThan20: { contractLoadLessThan20: 11 },
            acCountLessThan20: { acCountLessThan20: 11 },
            geyserCountLessThan20: { geyserCountLessThan20: 11 },
            transformerCapacityLessThan20: { transformerCapacityLessThan20: 11 },
            cableLengthBetweenInterverterAndTerminationPointLessThan20: { cableLengthBetweenInterverterAndTerminationPointLessThan20: 10 },
            cableLengthBetweenSolarModuleAndInterverterLessThan20: { cableLengthBetweenSolarModuleAndInterverterLessThan20: 11 },
            cableLengthBetweenInverterAndEarthingAreaLessThan20: { cableLengthBetweenInverterAndEarthingAreaLessThan20: 11 },
            cableLengthBetweenSolarModuleAndEarthingAreaLessThan20: { cableLengthBetweenSolarModuleAndEarthingAreaLessThan20: 11 },
            cableLengthBetweenPowerSocketAndMotorLessThan20: { cableLengthBetweenPowerSocketAndMotorLessThan20: 11 },
            typeOFAreaForEarthingLessThan20: "Loose soil",
            doestheClientHasAnLTPanelLessThan20: [
              {
                doestheClientHasAnLTPanelLessThan20: "YES",
                lengthOfLTPanelLessThan20: { lengthOfLTPanelLessThan20: 11 },
                widthOfLTPanelLessThan20: { widthOfLTPanelLessThan20: 11 },
                heightOfLTPanelLessThan20: { heightOfLTPanelLessThan20: 7 }
              }
            ],
            powerSocketInBetweenLTPanelAndSolarLocationLessThan20: "Yes",
            doesTheWifiHasFullStrengthNearTheLTPanelLessThan20: "Yes",
            nameOfBroadbandProviderLessThan20: "11",
            mcbRatingLessThan20: { mcbRatingLessThan20: 11 },
            wifiAvailabilityLessThan20: "Yes",
            wifiServiceProviderLessThan20: "Jio",
            wifiFrequencyBandLessThan20: "5Ghz Only",
            routerImageLessThan20: [
              {
                name: "Screenshot 2025-06-17 at 3.02.23 PM.png",
                type: "image/png",
                content: "https://freyr-energy-media-uat.s3.ap-south-1.amazonaws.com/survey/e155ca22-5928-4ffb-8219-e4575688fdb8_Screenshot-2025-06-17-at-3.02.23-PM1750152745653.png"
              }
            ]
          },
          media: {
            entireRoofLessThan20: [{ name: "Screenshot 2025-06-17 at 3.02.34 PM.png", type: "image/png", content: "https://freyr-energy-media-uat.s3.ap-south-1.amazonaws.com/survey/2aef6589-be6d-471d-bcbd-e11a855475c7_Screenshot-2025-06-17-at-3.02.34-PM1750152755451.png" }],
            mapMarkingLessThan20: [{ name: "Screenshot 2025-06-17 at 3.02.39 PM.png", type: "image/png", content: "https://freyr-energy-media-uat.s3.ap-south-1.amazonaws.com/survey/6caa7b57-e7a9-4b90-9b28-dd61b9e0e24a_Screenshot-2025-06-17-at-3.02.39-PM1750152760245.png" }],
            meterPhotoLessThan20: [{ name: "Screenshot 2025-06-17 at 3.02.41 PM.png", type: "image/png", content: "https://freyr-energy-media-uat.s3.ap-south-1.amazonaws.com/survey/627db4df-7bd9-4e9b-a343-99ee4e7eec23_Screenshot-2025-06-17-at-3.02.41-PM1750152762307.png" }],
            handSketchLessThan20: [{ name: "Screenshot 2025-06-17 at 3.02.43 PM.png", type: "image/png", content: "https://freyr-energy-media-uat.s3.ap-south-1.amazonaws.com/survey/78c0b01b-ef72-4194-a9f1-8bdba79631bd_Screenshot-2025-06-17-at-3.02.43-PM1750152764630.png" }],
            powerBillLessThan20: [{ name: "Screenshot 2025-06-17 at 3.02.46 PM.png", type: "image/png", content: "https://freyr-energy-media-uat.s3.ap-south-1.amazonaws.com/survey/0dd846af-f162-4fa4-a3fa-b88ecf36b207_Screenshot-2025-06-17-at-3.02.46-PM1750152767134.png" }],
            inverterMountingLessThan20: [{ name: "Screenshot 2025-06-17 at 3.02.48 PM.png", type: "image/png", content: "https://freyr-energy-media-uat.s3.ap-south-1.amazonaws.com/survey/12998292-740a-4077-b04b-0e7329c87d84_Screenshot-2025-06-17-at-3.02.48-PM1750152769323.png" }],
            earthingAreaLessThan20: [{ name: "Screenshot 2025-06-17 at 3.02.50 PM.png", type: "image/png", content: "https://freyr-energy-media-uat.s3.ap-south-1.amazonaws.com/survey/081725b2-aad2-4b11-ada0-6e34212e63c3_Screenshot-2025-06-17-at-3.02.50-PM1750152771788.png" }],
            lthtPanelNameplateLessThan20: [{ name: "Screenshot 2025-06-17 at 3.02.53 PM.png", type: "image/png", content: "https://freyr-energy-media-uat.s3.ap-south-1.amazonaws.com/survey/254bfba2-2b12-4d1b-be23-acd95012d12b_Screenshot-2025-06-17-at-3.02.53-PM1750152774024.png" }],
            designatedMaterialDeliveryAreaImageLessThan20: [{ name: "Screenshot 2025-06-17 at 3.02.53 PM.png", type: "image/png", content: "https://freyr-energy-media-uat.s3.ap-south-1.amazonaws.com/survey/254bfba2-2b12-4d1b-be23-acd95012d12b_Screenshot-2025-06-17-at-3.02.53-PM1750152774024.png" }],
            designatedMaterialDeliveryAreaVideoLessThan20: [{ name: "6f247569-f958-4331-8682-6db340204ae5-100029566417792021198641783277877766.mp4", type: "video/mp4", content: "https://freyr-energy-media-prod.s3.ap-south-1.amazonaws.com/survey/f403ff71-d0f6-42e3-b032-54fb09371232_10005045571783257192417.mp4" }]
          }
        }
      }},
"preInstall": {title:"Pre-installation", payload:{
        query: `mutation ($input: savePreInstallationFormInput) {
      savePreInstallationForm (input: $input) {
    message
  }
    }`,
        variables: {
          input: {
            project: "{{projectId}}",
            projectDetails: {
              uniqueId: "{{uniqueId}}",
              projectName: "CustomerB Support Module_residential_independent",
              freyrSiteEngineerName: "test site eng",
              systemCapacity: "{{systemSize}}",
              freyrSiteEngineer: "67ca958234a956e0d98304e3",
              dateOfFormSubmission: "2026-10-30",
              phoneNumberOfClient: "2111122221",
              startDateofInstallation: "2026-10-30"
            },
            ppeAcknowledgedAt: 1793364674328,
            customerDetails: {
              nameofClientOnSite: "CustomerB Support Module",
              phoneNumberOfClient: "2111122221",
              vendorCompanyName: null,
              VendorFirstName: null,
              VendorLastName: null,
              vendorMobileNumber: null,
              vendorEmailId: null,
              preInstallationChecklist: {
                siteIsShadowFree: "Yes",
                siteIsAsPerDPR: "Yes",
                allMaterialReceivedAsPerBOM: "Yes"
              }
            },
            media: {
              installationCrewPhoto: [{ name: "Screenshot 2026-10-22 at 2.38.49 PM.png", type: "image/png", content: "https://freyr-energy-media-uat.s3.ap-south-1.amazonaws.com/se-pre-installation/f427ea9f-96a1-4d5f-8129-525b4713a49e_Screenshot-2026-10-22-at-2.38.49-PM1793364691917.png" }],
              preInstallationSiteVideo: [{ name: "Screen Recording 2026-10-27 at 12.53.51 PM.mov", type: "video/quicktime", content: "https://freyr-energy-media-uat.s3.ap-south-1.amazonaws.com/se-pre-installation/1bb26c4a-50b7-4e4b-a39a-e87195fff235_Screen-Recording-2026-10-27-at-12.53.51-PM1793364725937.mov" }],
              completeMaterialVideo: [{ name: "Screen Recording 2026-10-27 at 12.53.51 PM.mov", type: "video/quicktime", content: "https://freyr-energy-media-uat.s3.ap-south-1.amazonaws.com/se-pre-installation/9399fb77-8dfd-4a04-996e-ee1b58080b4d_Screen-Recording-2026-10-27-at-12.53.51-PM1793364721002.mov" }],
              ModulesPhotos1: [{ name: "Screenshot 2026-10-22 at 2.17.13 PM.png", type: "image/png", content: "https://freyr-energy-media-uat.s3.ap-south-1.amazonaws.com/se-pre-installation/c2405625-8591-4477-94d3-3f4fbf0771fa_Screenshot-2026-10-22-at-2.17.13-PM1793364697193.png" }],
              ModulesPhotos2: [{ name: "Screenshot 2026-10-22 at 2.17.29 PM.png", type: "image/png", content: "https://freyr-energy-media-uat.s3.ap-south-1.amazonaws.com/se-pre-installation/449b4592-476a-41ae-9a12-3a9366097782_Screenshot-2026-10-22-at-2.17.29-PM1793364700734.png" }],
              inverter: [{ name: "Screenshot 2026-10-22 at 2.19.18 PM.png", type: "image/png", content: "https://freyr-energy-media-uat.s3.ap-south-1.amazonaws.com/se-pre-installation/9bc5f2c2-90dc-4fdb-9e55-851a53749a94_Screenshot-2026-10-22-at-2.19.18-PM1793364707030.png" }],
              geoTaggedSitePhoto: [{ name: "Gemini_Generated_Image_9hva6m9hva6m9hva (1).png", type: "image/png", content: "https://freyr-energy-media-uat.s3.ap-south-1.amazonaws.com/se-pre-installation/97c9cc4a-954f-4101-a85f-3b2f82b97f45_Gemini-Generated-Image-9hva6m9hva6m9hva-%281%291793364817447.png" }]
            },
            isLastPage: true
          }
        }
      }},
"postInstall": {
  "title": "Post-installation",
  "payload": {
    "query": "mutation ($input: savePostInstallationFormInput) {\n      savePostInstallationForm (input: $input) {\n    message\n  }\n    }",
    "variables": {
      "input": {
        "project": "{{projectId}}",
        "isLastPage": true,
        "projectDetails": {
          "uniqueId": "{{uniqueId}}",
          "projectName": "CustomerB Support Module_residential_independent",
          "systemCapacity": "{{systemSize}}",
          "freyrSiteEngineer": "67ca958234a956e0d98304e3",
          "freyrSiteEngineerName": "test site eng",
          "vendorCompanyName": null,
          "vendorMobileNumber": null,
          "vendorEmailId": null,
          "firstName": "test",
          "lastName": "site eng"
        },
        "media": {
          "videoOfAnchorFastnersDrillingAndChemicalFilling": [
            {
              "name": "Screen_Recording_2026-10-08_at_12.26.00_PM.mov",
              "type": "video/quicktime",
              "content": "https://freyr-energy-media-uat.s3.ap-south-1.amazonaws.com/se-post-installation/6c42fd71-5376-42e5-b200-d39ae92e8001_Screen-Recording-2026-10-08-at-12.26.00-PM1793364955856.mov"
            }
          ],
          "structureInstallationPhoto": [
            {
              "name": "Screenshot 2026-10-22 at 2.19.18 PM.png",
              "type": "image/png",
              "content": "https://freyr-energy-media-uat.s3.ap-south-1.amazonaws.com/se-post-installation/f1f86009-eec7-4781-8431-c73e74775e29_Screenshot-2026-10-22-at-2.19.18-PM1793365034529.png"
            }
          ],
          "moduleInstalliationPhoto": [
            {
              "name": "Gemini_Generated_Image_9hva6m9hva6m9hva (1).png",
              "type": "image/png",
              "content": "https://freyr-energy-media-uat.s3.ap-south-1.amazonaws.com/se-post-installation/58476d05-afa7-4696-8fa0-6114b9d90b17_Gemini-Generated-Image-9hva6m9hva6m9hva-%281%291793365054824.png",
              "extractedInfo": {
                "fields": {
                  "latitude": "13.59350",
                  "longitude": "79.52220"
                }
              }
            }
          ],
          "inverterAndDataLoggerSNoPhoto": [
            {
              "name": "Gemini_Generated_Image_9hva6m9hva6m9hva (1).png",
              "type": "image/png",
              "content": "https://freyr-energy-media-uat.s3.ap-south-1.amazonaws.com/se-post-installation/99b89925-626a-448e-85d0-25a0c50b58da_Gemini-Generated-Image-9hva6m9hva6m9hva-%281%291793365060429.png"
            }
          ],
          "inverterTestReport": [
            {
              "name": "Screenshot 2026-10-22 at 2.17.13 PM.png",
              "type": "image/png",
              "content": "https://freyr-energy-media-uat.s3.ap-south-1.amazonaws.com/se-post-installation/d2afb551-f186-49a0-9220-6ea108fbfd13_Screenshot-2026-10-22-at-2.17.13-PM1793365042254.png"
            }
          ],
          "postInstallationEarthPitsPhotos": [
            {
              "name": "Screenshot 2026-10-22 at 2.17.13 PM.png",
              "type": "image/png",
              "content": "https://freyr-energy-media-uat.s3.ap-south-1.amazonaws.com/se-post-installation/30aca7ea-a385-4ca6-84b5-2053568a3dd6_Screenshot-2026-10-22-at-2.17.13-PM1793364997164.png"
            }
          ],
          "postInstallationInverterOrACDBOrDCDBPhoto": [
            {
              "name": "Gemini_Generated_Image_9hva6m9hva6m9hva (1).png",
              "type": "image/png",
              "content": "https://freyr-energy-media-uat.s3.ap-south-1.amazonaws.com/se-post-installation/8c5098d3-6c74-4523-909f-6baebdd7f712_Gemini-Generated-Image-9hva6m9hva6m9hva-%281%291793365060673.png",
              "extractedInfo": {
                "fields": {
                  "latitude": "13.59350",
                  "longitude": "79.52220"
                }
              }
            }
          ],
          "earthPitInstallationVideo": [
            {
              "name": "Screen_Recording_2026-10-08_at_12.26.00_PM.mov",
              "type": "video/quicktime",
              "content": "https://freyr-energy-media-uat.s3.ap-south-1.amazonaws.com/se-post-installation/151017a8-3509-452f-a5dc-12d737f396ac_Screen-Recording-2026-10-08-at-12.26.00-PM1793364967016.mov"
            }
          ],
          "civilFoundationOrWorkPhotos": [
            {
              "name": "Gemini_Generated_Image_9hva6m9hva6m9hva (1).png",
              "type": "image/png",
              "content": "https://freyr-energy-media-uat.s3.ap-south-1.amazonaws.com/se-post-installation/c740b64a-c858-4b48-ada2-ff4c2cac6958_Gemini-Generated-Image-9hva6m9hva6m9hva-%281%291793365066041.png"
            }
          ],
          "installationCrewPhotoWithSystem": [
            {
              "name": "Screenshot 2026-10-22 at 2.17.29 PM.png",
              "type": "image/png",
              "content": "https://freyr-energy-media-uat.s3.ap-south-1.amazonaws.com/se-post-installation/5791cf7e-5c45-4519-ac7a-3cbc7f547c5c_Screenshot-2026-10-22-at-2.17.29-PM1793365010649.png"
            }
          ],
          "beneficiaryPhotoAlongWithCompleteInverterSetUp": [
            {
              "name": "Screenshot 2026-10-22 at 2.17.13 PM.png",
              "type": "image/png",
              "content": "https://freyr-energy-media-uat.s3.ap-south-1.amazonaws.com/se-post-installation/e26574a9-e987-4597-83a8-8603768e21ed_Screenshot-2026-10-22-at-2.17.13-PM1793365015867.png"
            }
          ],
          "beneficiaryPhotoAlongWithCompleteModuleSetUp": [
            {
              "name": "Screenshot 2026-10-22 at 2.17.29 PM.png",
              "type": "image/png",
              "content": "https://freyr-energy-media-uat.s3.ap-south-1.amazonaws.com/se-post-installation/50cf7756-0928-4143-8b1b-62baad0451c1_Screenshot-2026-10-22-at-2.17.29-PM1793365006779.png"
            }
          ],
          "postInstallationCeilingPhoto": [
            {
              "name": "Screenshot 2026-10-22 at 2.17.13 PM.png",
              "type": "image/png",
              "content": "https://freyr-energy-media-uat.s3.ap-south-1.amazonaws.com/se-post-installation/b0a10022-6a9a-4ecc-8d90-f6667d307c61_Screenshot-2026-10-22-at-2.17.13-PM1793365019243.png"
            }
          ],
          "structureAreaCleanupPhoto": [
            {
              "name": "Screenshot 2026-10-22 at 2.17.13 PM.png",
              "type": "image/png",
              "content": "https://freyr-energy-media-uat.s3.ap-south-1.amazonaws.com/se-post-installation/372fb877-f7c9-4542-831f-3f8f0f248c91_Screenshot-2026-10-22-at-2.17.13-PM1793365022963.png"
            }
          ],
          "roofCleanupPhoto": [
            {
              "name": "Screenshot 2026-10-22 at 2.17.29 PM.png",
              "type": "image/png",
              "content": "https://freyr-energy-media-uat.s3.ap-south-1.amazonaws.com/se-post-installation/f83f90ae-5b52-4e77-8ee6-8efd2ac5ae11_Screenshot-2026-10-22-at-2.17.29-PM1793365025854.png"
            }
          ],
          "materialStorageAreaCleanupPhoto": [
            {
              "name": "Screenshot 2026-10-22 at 2.17.13 PM.png",
              "type": "image/png",
              "content": "https://freyr-energy-media-uat.s3.ap-south-1.amazonaws.com/se-post-installation/98abfcbc-2494-4f87-b002-d75768521355_Screenshot-2026-10-22-at-2.17.13-PM1793365028934.png"
            }
          ],
          "postInstallationFullSiteVideo": [
            {
              "name": "Screen_Recording_2026-10-08_at_12.26.00_PM.mov",
              "type": "video/quicktime",
              "content": "https://freyr-energy-media-uat.s3.ap-south-1.amazonaws.com/se-post-installation/6a436250-5a09-4e2d-9ee5-1906846ecec8_Screen-Recording-2026-10-08-at-12.26.00-PM1793364986883.mov"
            }
          ],
          "acCableTerminationAtClientsPanelOrMeter": [
            {
              "name": "Screenshot 2026-10-29 at 4.37.58 PM.png",
              "type": "image/png",
              "content": "https://freyr-energy-media-uat.s3.ap-south-1.amazonaws.com/se-post-installation/71306a36-52e2-41f2-8d1b-f65b71e1df5c_Screenshot-2026-10-29-at-4.37.58-PM1793365001000.png"
            }
          ]
        },
        "customerDetails": {
          "nameofClientOnSite": "CustomerB Support Module",
          "phoneNumberOfClient": "2111122221",
          "clientCooperationonSite": 5,
          "dateOfFormSubmission": "2026-10-30",
          "endDateOfInstallation": "2026-10-30",
          "rmsUsername": "1",
          "rmsPassword": "1",
          "rmsSetupViaWifiOrMobileHotspot": "Wifi",
          "overallInstallationExperience": 5
        }
      }
    }
  }
},

qc: {
  "title": "QC Form",
  "payload": {
    "query": "mutation ($input: saveQaFormInput) {\n      saveQaForm (input: $input) {\n    message\n  }\n    }",
    "variables": {
      "input": {
        "project": "{{projectId}}",
        "isLastPage": true,
        "projectDetails": {
          "projectId": "{{uniqueId}}",
          "engineerName": "Test SE",
          "projectName": "Test Rita FnxWf_residential_independent",
          "noOfStrings": "1 String",
          "voltageatString1": "1",
          "currentatString1": "11",
          "voltageatString1mcb": "1",
          "inverterMake": "SOLIS",
          "internetProvider": "1",
          "rmsUserName": "1",
          "rmsPassword": "1",
          "rmsSetUpViaHotspot": "Client Mobile Hotspot",
          "freyrAppSyncedWithInverter": "YES",
          "freyrAppSyncedWithWiser": "YES",
          "wiserInstallationDetails": {
            "wiserInstallationAtSite": "SCHNEIDER",
            "applicableMeter": "SINGLE_PHASE_METER",
            "singlePhaseMeterDetails": {
              "singlePhaseMacId": "1",
              "singlePhaseWiserAppId": "1",
              "singlePhaseWiserAppPassword": "1",
              "singlePhaseInternetSource": "Wi_Fi"
            }
          },
          "quanlityAssessmentParameters": {
            "plantInstalledPerDPR": "Yes",
            "dcStringLayout": "Yes",
            "properCivilFoundation": "Yes",
            "properStrunctureAlignment": "Yes",
            "properSolarPanelAlignment": "Yes",
            "properConduitLaying": "Yes",
            "properCableDressing": "Yes",
            "freyrNamePlateInstalled": "Yes",
            "dangerBoardInstalled": "Yes",
            "allMidClampsInstalledCorrectly": "Yes",
            "allendClampsInstalledCorrectly": "Yes",
            "allNutsInstalledCorrectly": "Yes",
            "rmsConfigurationDoneAtTimeOfInstallation": "Yes",
            "appAvailableOnCustomerPhoneSinceInstallation": "Yes",
            "lightingArrestorInstalledProperly": "Yes",
            "meterDistanceBetweenEachEarthPit": "Yes",
            "lugsUsedAtEarthCableConnections": "Yes",
            "cableTiesInstalledProperly": "Yes",
            "inverterClearanceOnAllSides": "Yes",
            "cableTightness": "Yes",
            "siteCleaningAfterInstallation": "Yes",
            "mcConnectorsTightness": "Yes"
          },
          "qualityAssessmentCheckList": {
            "appInstalledInClientPhone": "Yes",
            "appRegisteredOnClientPhone": "Yes",
            "generationDetailsVisibleOnApp": "Yes",
            "inverterAppDeletedFromClientPhone": "Yes",
            "moduleCleaningDemoGivenToClient": "Yes",
            "solatPlantWorkingExplainedToCustomer": "Yes"
          },
          "remarksForNotAsPerDpr": "test",
          "sprinklerSystemInstalled": "No",
          "googleReviewTaken": "No"
        },
        "media": {
          "civilFoundation": [
            {
              "name": "Delivery proof.jpg",
              "type": "image/jpeg",
              "content": "https://freyr-energy-media-uat.s3.ap-south-1.amazonaws.com/se-qc/015cdb26-8c1d-4d01-a340-97c806560729_Delivery-proof1792400431966.jpg"
            }
          ],
          "structureAlignment": [
            {
              "name": "Delivery proof.jpg",
              "type": "image/jpeg",
              "content": "https://freyr-energy-media-uat.s3.ap-south-1.amazonaws.com/se-qc/a217ba5c-94e4-4b7b-b35e-c8b330db7d03_Delivery-proof1792400434363.jpg"
            }
          ],
          "solarModulesAlignment": [
            {
              "name": "Delivery proof.jpg",
              "type": "image/jpeg",
              "content": "https://freyr-energy-media-uat.s3.ap-south-1.amazonaws.com/se-qc/e447353f-1590-4ad6-bdb9-9c434fe16d19_Delivery-proof1792400437175.jpg"
            }
          ],
          "midEndClamps": [
            {
              "name": "Delivery proof.jpg",
              "type": "image/jpeg",
              "content": "https://freyr-energy-media-uat.s3.ap-south-1.amazonaws.com/se-qc/78a74307-35ed-459e-b4d4-a0ea6ac4c2bf_Delivery-proof1792400439513.jpg"
            }
          ],
          "inverterSetUp": [
            {
              "name": "Delivery proof.jpg",
              "type": "image/jpeg",
              "content": "https://freyr-energy-media-uat.s3.ap-south-1.amazonaws.com/se-qc/735d17c4-8a0d-4d60-ae14-c5e5456c314a_Delivery-proof1792400442506.jpg"
            }
          ],
          "inverterBodyEarthing": [
            {
              "name": "Delivery proof.jpg",
              "type": "image/jpeg",
              "content": "https://freyr-energy-media-uat.s3.ap-south-1.amazonaws.com/se-qc/6b513394-b18c-4121-844e-287f16a9a900_Delivery-proof1792400444811.jpg"
            }
          ],
          "lungs": [
            {
              "name": "Delivery proof.jpg",
              "type": "image/jpeg",
              "content": "https://freyr-energy-media-uat.s3.ap-south-1.amazonaws.com/se-qc/cd446843-3be2-4b2c-a249-51ec0530b585_Delivery-proof1792400447638.jpg"
            }
          ],
          "inverterStringLayout": [
            {
              "name": "Delivery proof.jpg",
              "type": "image/jpeg",
              "content": "https://freyr-energy-media-uat.s3.ap-south-1.amazonaws.com/se-qc/dd3518d8-b708-415a-ad0c-4d6418e5e2c8_Delivery-proof1792400449886.jpg"
            }
          ],
          "earthPits": [
            {
              "name": "Delivery proof.jpg",
              "type": "image/jpeg",
              "content": "https://freyr-energy-media-uat.s3.ap-south-1.amazonaws.com/se-qc/5999e043-ec09-4ebe-b95c-5453e3d5b089_Delivery-proof1792400452548.jpg"
            }
          ],
          "conduit": [
            {
              "name": "Delivery proof.jpg",
              "type": "image/jpeg",
              "content": "https://freyr-energy-media-uat.s3.ap-south-1.amazonaws.com/se-qc/9f5dddee-82f1-4499-9b45-b77c6dde283f_Delivery-proof1792400454807.jpg"
            }
          ],
          "BeneficiaryAlongWithModules": [
            {
              "name": "Delivery proof.jpg",
              "type": "image/jpeg",
              "content": "https://freyr-energy-media-uat.s3.ap-south-1.amazonaws.com/se-qc/0ff5a529-deb0-4ad0-9b84-6610ffedb122_Delivery-proof1792400474543.jpg"
            }
          ],
          "BeneficiaryAlongWithInverterSetUp": [
            {
              "name": "Delivery proof.jpg",
              "type": "image/jpeg",
              "content": "https://freyr-energy-media-uat.s3.ap-south-1.amazonaws.com/se-qc/0e1dfb2f-3db5-4c97-a15f-d8858834bf10_Delivery-proof1792400478355.jpg"
            }
          ],
          "photoOfAppInstalledInClientPhone": [
            {
              "name": "Delivery proof.jpg",
              "type": "image/jpeg",
              "content": "https://freyr-energy-media-uat.s3.ap-south-1.amazonaws.com/se-qc/16bb71e7-3ef2-4f3f-be52-2a6bde6752d0_Delivery-proof1792400457731.jpg"
            }
          ],
          "freyrWiserSync": [
            {
              "name": "Delivery proof.jpg",
              "type": "image/jpeg",
              "content": "https://freyr-energy-media-uat.s3.ap-south-1.amazonaws.com/se-qc/00b8e484-f371-4314-9db8-58126ba49784_Delivery-proof1792400460020.jpg"
            }
          ],
          "torqueWitnessMarkVerification": [
            {
              "name": "Delivery proof.jpg",
              "type": "image/jpeg",
              "content": "https://freyr-energy-media-uat.s3.ap-south-1.amazonaws.com/se-qc/77045efc-aeae-4741-afd2-55a443203c28_Delivery-proof1792400463190.jpg"
            }
          ],
          "inverterGenerationScreenshotInFreyrApp": [
            {
              "name": "Delivery proof.jpg",
              "type": "image/jpeg",
              "content": "https://freyr-energy-media-uat.s3.ap-south-1.amazonaws.com/se-qc/f3f1b470-6fd8-40a0-b8e9-291e662600ee_Delivery-proof1792400377828.jpg"
            }
          ],
          "wiserGenerationScreenshotInFreyrApp": [
            {
              "name": "cancelled-cheque.png",
              "type": "image/png",
              "content": "https://freyr-energy-media-uat.s3.ap-south-1.amazonaws.com/se-qc/00f7d544-9305-4e74-9d9a-5f6fa024317d_cancelled-cheque1792400384868.png"
            }
          ],
          "wiserSinglePhaseMacIdImage": [
            {
              "name": "Delivery proof.jpg",
              "type": "image/jpeg",
              "content": "https://freyr-energy-media-uat.s3.ap-south-1.amazonaws.com/se-qc/9612ee8c-921e-4691-8cb5-2102becbc61b_Delivery-proof1792400399612.jpg"
            }
          ],
          "wiserSinglePhaseAppScreenshot": [
            {
              "name": "Delivery proof.jpg",
              "type": "image/jpeg",
              "content": "https://freyr-energy-media-uat.s3.ap-south-1.amazonaws.com/se-qc/71c97bc5-7203-4c42-9f01-20e23b3fe215_Delivery-proof1792400402181.jpg"
            }
          ]
        },
        "customerDetails": {
          "customerFirstName": "Test Rita",
          "customerLastName": "FnxWf",
          "customerPhoneNumber": "3934577346"
        },
        "qcFormOTPVerifiedAt": 1793364727971
      }
    }
  }
}
});
})();
