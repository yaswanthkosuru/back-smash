import OpenAI from 'openai';
const { StorageSharedKeyCredential, BlobServiceClient, generateBlobSASQueryParameters, BlobSASPermissions } = require("@azure/storage-blob");

const openai = new OpenAI({
  apiKey: process.env["OPENAI_API_KEY"], // defaults to process.env["OPENAI_API_KEY"]
});

const AZURE_STORAGE_ACCOUNT = process.env["AZURE_STORAGE_ACCOUNT_NAME"]
const AZURE_STORAGE_ACCESS_KEY = process.env["AZURE_STORAGE_ACCESS_KEY"]
const sharedKeyCredential = new StorageSharedKeyCredential(AZURE_STORAGE_ACCOUNT, AZURE_STORAGE_ACCESS_KEY);
// const defaultAzureCredential = new DefaultAzureCredential();
const blobServiceClient = new BlobServiceClient(
  `https://${AZURE_STORAGE_ACCOUNT}.blob.core.windows.net`,
  sharedKeyCredential
);

export const transcribeRecording = async (blobLocation: string) => {
  try {
    console.log('blobLocation', blobLocation);
    const parts = blobLocation.split('/');
    console.log('parts', parts);
    const containerName = parts[3];
    const folderName = parts[4];
    const fileName = parts[5];
    const blobName = `${folderName}/${fileName}`;
    // Blob URL
    // const blobUrl = `https://${AZURE_STORAGE_ACCOUNT}.blob.core.windows.net/${blobLocation}`;
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const blobClient = containerClient.getBlobClient(blobName);

    // Generating SAS Token
    const sasToken = generateBlobSASQueryParameters({
        containerName: containerName,
        blobName: blobName,
        expiresOn: new Date(new Date().valueOf() + (10 * 60 * 1000)),// 10 minutes
        permissions: BlobSASPermissions.parse("racwd")
    }, sharedKeyCredential);

    // Getting SAS URL for blob
    const sasUrl = `${blobClient.url}?${sasToken}`;
    console.log("sasUrl >>", sasUrl)

    // Getting the transcription of the file
    const transcription = await openai.audio.transcriptions.create({
        file: await fetch(sasUrl),
        model: "whisper-1",
    });
    console.log('transcription', transcription);
    return transcription;
  } catch (error) {
    throw error
  }
}