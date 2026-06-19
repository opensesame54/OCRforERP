const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const postInvoiceToOdoo = (invoicePayload) => {
  return new Promise((resolve, reject) => {
    // Generate temp file path
    const tempFileDir = path.join(__dirname, '../temp');
    if (!fs.existsSync(tempFileDir)) {
      fs.mkdirSync(tempFileDir, { recursive: true });
    }
    const tempFilePath = path.join(tempFileDir, `inv_stage_${Date.now()}.json`);

    // Write payload
    fs.writeFileSync(tempFilePath, JSON.stringify(invoicePayload, null, 2), 'utf-8');

    // Run staging record creation in python uploader
    const workspaceDir = path.join(__dirname, '../../');
    const venvPython = path.join(workspaceDir, '.venv/bin/python');
    const uploaderScript = path.join(workspaceDir, 'odoo_staging_uploader.py');

    // Set PYTHONPATH to ensure imports work correctly
    const cmd = `PYTHONPATH="${workspaceDir}" "${venvPython}" "${uploaderScript}" "${tempFilePath}"`;

    console.log('Odoo Bridge Command:', cmd);

    exec(cmd, { cwd: workspaceDir }, (error, stdout, stderr) => {
      // Clean up temp file
      try {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      } catch (err) {}

      if (error) {
        console.error('Odoo Bridge Staging Error:', stderr || error.message);
        return reject(new Error(stderr || error.message));
      }

      try {
        const result = JSON.parse(stdout.trim());
        const stagingId = result.staging_id;

        if (!stagingId) {
          return reject(new Error('Failed to get staging_id from Odoo uploader. Output: ' + stdout));
        }

        // Now trigger vendor bill posting using staging_id
        const postCmd = `PYTHONPATH="${workspaceDir}" "${venvPython}" "${uploaderScript}" --post-staging-id ${stagingId}`;
        console.log('Odoo Bridge Posting Command:', postCmd);

        exec(postCmd, { cwd: workspaceDir }, (postError, postStdout, postStderr) => {
          if (postError) {
            console.error('Odoo Bridge Posting Error:', postStderr || postError.message);
            // Staged but bill post failed
            return resolve({
              status: 'Staged',
              stagingId: stagingId,
              billId: null,
              logs: ['Staging Successful.', 'Odoo Bill Posting Error: ' + (postStderr || postError.message)]
            });
          }

          try {
            const postResult = JSON.parse(postStdout.trim());
            return resolve({
              status: 'Posted',
              stagingId: stagingId,
              billId: postResult.vendor_bill_id,
              logs: ['Staging Successful.', 'Vendor Bill posted successfully to Account Moves.']
            });
          } catch (pe) {
            return resolve({
              status: 'Staged',
              stagingId: stagingId,
              billId: null,
              logs: ['Staging Successful.', 'Failed to parse posting output: ' + postStdout]
            });
          }
        });

      } catch (parseError) {
        return reject(new Error('Failed to parse uploader output: ' + stdout));
      }
    });
  });
};

const syncInvoicesFromOdoo = () => {
  return new Promise((resolve, reject) => {
    const workspaceDir = path.join(__dirname, '../../');
    const venvPython = path.join(workspaceDir, '.venv/bin/python');
    const syncScript = path.join(__dirname, 'odoo_sync.py');
    
    // Set PYTHONPATH to ensure imports work correctly
    const cmd = `PYTHONPATH="${workspaceDir}" "${venvPython}" "${syncScript}"`;
    console.log('Odoo Bridge Sync Command:', cmd);

    exec(cmd, { cwd: workspaceDir, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        console.error('Odoo Bridge Sync Error:', stderr || error.message);
        return reject(new Error(stderr || error.message));
      }

      try {
        const result = JSON.parse(stdout.trim());
        if (result.error) {
          return reject(new Error(result.error));
        }
        return resolve(result);
      } catch (parseError) {
        return reject(new Error('Failed to parse sync output: ' + stdout));
      }
    });
  });
};

module.exports = { postInvoiceToOdoo, syncInvoicesFromOdoo };
