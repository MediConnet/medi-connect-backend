const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const STAGE = process.env.STAGE || 'dev';
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

// Obtener bucket name del stack de CloudFormation o usar default
const ARTIFACT_BUCKET = process.env.ARTIFACT_BUCKET || `medi-connect-artifacts-${STAGE}`;

console.log('☁️  Uploading artifacts to S3...\n');
console.log(`   Bucket: ${ARTIFACT_BUCKET}`);
console.log(`   Region: ${AWS_REGION}\n`);

const artifactsDir = path.join(__dirname, '..', 'artifacts');

// Verificar que el bucket existe
try {
  execSync(`aws s3 ls s3://${ARTIFACT_BUCKET}`, { stdio: 'pipe' });
} catch (error) {
  console.log(`⚠️  Bucket ${ARTIFACT_BUCKET} not found. Creating...`);
  execSync(`aws s3 mb s3://${ARTIFACT_BUCKET} --region ${AWS_REGION}`, { stdio: 'inherit' });
}

// Upload Lambdas
console.log('📤 Uploading Lambda functions...');
const lambdasDir = path.join(artifactsDir, 'lambdas');
if (fs.existsSync(lambdasDir)) {
  const lambdaFiles = fs.readdirSync(lambdasDir);
  lambdaFiles.forEach(file => {
    if (file.endsWith('.zip')) {
      const filePath = path.join(lambdasDir, file);
      const s3Key = `lambdas/${file}`;
      console.log(`  ✓ Uploading ${file}...`);
      execSync(`aws s3 cp "${filePath}" "s3://${ARTIFACT_BUCKET}/${s3Key}"`, { stdio: 'inherit' });
    }
  });
}

// Upload Layers
console.log('\n📤 Uploading Lambda layers...');
const layersDir = path.join(artifactsDir, 'layers');
if (fs.existsSync(layersDir)) {
  const layerFiles = fs.readdirSync(layersDir);
  layerFiles.forEach(file => {
    if (file.endsWith('.zip')) {
      const filePath = path.join(layersDir, file);
      const s3Key = `layers/${file}`;
      console.log(`  ✓ Uploading ${file}...`);
      execSync(`aws s3 cp "${filePath}" "s3://${ARTIFACT_BUCKET}/${s3Key}"`, { stdio: 'inherit' });
    }
  });
}

console.log('\n✅ Upload complete!');
console.log(`📦 Artifacts uploaded to: s3://${ARTIFACT_BUCKET}`);
