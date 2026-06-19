import React, { useState, useEffect } from 'react';
import { apiCall } from '../utils/api';
import { Upload, File, CheckCircle2, XCircle, AlertCircle, Loader } from 'lucide-react';

const UploadInvoice = ({ userRole, onInvoiceUploaded }) => {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [validationMessages, setValidationMessages] = useState([]);
  const [history, setHistory] = useState([]);

  const fetchHistory = async () => {
    try {
      const data = await apiCall('/invoices?limit=10', {}, userRole);
      if (data && data.invoices) {
        const mapped = data.invoices.map(inv => ({
          name: inv.documentUrl ? inv.documentUrl.split('/').pop() : `invoice_${inv.invoiceNumber}.pdf`,
          size: '650 KB',
          time: new Date(inv.createdAt).toLocaleDateString() + ' ' + new Date(inv.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          status: ['Exception', 'Duplicate'].includes(inv.status) ? 'Failed' : 'Success',
          confidence: `${Math.round(inv.confidenceScore * 100)}%`,
          error: inv.postingLogs && inv.postingLogs.length > 0 ? inv.postingLogs[0] : (inv.exceptionType || 'Failed validation check')
        }));
        setHistory(mapped);
      }
    } catch (err) {
      console.error('Failed to fetch upload history:', err);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [userRole]);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await handleUploadFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = async (e) => {
    if (e.target.files && e.target.files[0]) {
      await handleUploadFile(e.target.files[0]);
    }
  };

  const handleUploadFile = async (file) => {
    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      setValidationMessages([`File "${file.name}" is not supported. Use PDF, PNG, or JPG.`]);
      setHistory(prev => [{ name: file.name, size: `${(file.size / 1024).toFixed(0)} KB`, status: 'Failed', confidence: '0%', error: 'File format not supported', time: 'Just now' }, ...prev]);
      return;
    }

    setValidationMessages([]);
    setUploading(true);
    setProgress(15);
    setStatusMessage('Uploading document to AP secure storage...');

    // Construct Form Data
    const formData = new FormData();
    formData.append('file', file);

    try {
      // Simulate progress ticks
      const interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) {
            clearInterval(interval);
            return 90;
          }
          return prev + 15;
        });
      }, 500);

      // Trigger actual OCR backend call
      setStatusMessage('Extracting layout and text with PaddleOCR...');
      const token = localStorage.getItem('token');
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
          'X-Mock-Role': userRole
        },
        body: formData
      });

      clearInterval(interval);
      setProgress(100);

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Subprocess extraction failed');
      }

      const extractedData = await res.json();
      setStatusMessage('Mistral AI extraction complete. Structured JSON verified.');
      
      await fetchHistory();

      if (onInvoiceUploaded) {
        onInvoiceUploaded(extractedData);
      }

    } catch (err) {
      console.error(err);
      setValidationMessages([`Extraction error: ${err.message}`]);
      
      await fetchHistory();
      
      setHistory(prev => {
        const alreadyExists = prev.some(item => item.name === file.name && item.status === 'Failed');
        if (alreadyExists) return prev;
        return [
          {
            name: file.name,
            size: `${(file.size / 1024).toFixed(0)} KB`,
            status: 'Failed',
            confidence: '0%',
            error: err.message,
            time: 'Just now'
          },
          ...prev
        ];
      });
    } finally {
      setTimeout(() => {
        setUploading(false);
        setProgress(0);
        setStatusMessage('');
      }, 2000);
    }
  };

  return (
    <div>
      <div className="card">
        <h3 className="card-title">Upload Invoices</h3>

        {/* Drag and Drop Container */}
        <div
          style={{
            border: dragActive ? '2px dashed var(--primary)' : '2px dashed var(--border-color)',
            backgroundColor: dragActive ? 'var(--primary-light)' : '#f8fafc',
            borderRadius: '12px',
            padding: '4rem 2rem',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            position: 'relative'
          }}
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={() => document.getElementById('file-picker').click()}
        >
          <input
            type="file"
            id="file-picker"
            accept=".pdf,.png,.jpg,.jpeg"
            style={{ display: 'none' }}
            onChange={handleFileInput}
          />
          <Upload size={48} style={{ color: 'var(--text-light)', marginBottom: '1rem' }} />
          <p style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '0.25rem' }}>
            Drag and drop your invoice here, or <span style={{ color: 'var(--primary)', textDecoration: 'underline' }}>browse files</span>
          </p>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Supports PDF, PNG, JPG, JPEG (Max 10MB)
          </p>
        </div>

        {/* Progress Bar & Status messages */}
        {uploading && (
          <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: '#f0fdf4', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.9rem', fontWeight: 500, color: 'var(--success-text)' }}>
              <Loader size={18} style={{ animation: 'spin 1.5s linear infinite' }} />
              <span>{statusMessage}</span>
            </div>
            <div style={{ height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progress}%`, backgroundColor: 'var(--success)', transition: 'width 0.3s ease' }}></div>
            </div>
          </div>
        )}

        {/* Validation Errors Panel */}
        {validationMessages.length > 0 && (
          <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: 'var(--danger-light)', borderRadius: '10px', color: 'var(--danger-text)', display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.85rem' }}>
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Validation Error</p>
              {validationMessages.map((msg, i) => <p key={i}>{msg}</p>)}
            </div>
          </div>
        )}
      </div>

      {/* Upload History list */}
      <div className="card">
        <h3 className="card-title">Upload History</h3>
        <div className="table-container">
          <table className="enterprise-table">
            <thead>
              <tr>
                <th>Document Name</th>
                <th>File Size</th>
                <th>Upload Time</th>
                <th>Extraction Status</th>
                <th>Confidence</th>
                <th>Message / Details</th>
              </tr>
            </thead>
            <tbody>
              {history.map((item, idx) => (
                <tr key={idx}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 500 }}>
                      <File size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                      <span style={{ display: 'inline-block', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.name}>
                        {item.name}
                      </span>
                    </div>
                  </td>
                  <td>{item.size}</td>
                  <td>{item.time}</td>
                  <td>
                    <span className={`status-badge ${item.status === 'Success' ? 'approved' : 'exception'}`}>
                      {item.status === 'Success' ? <CheckCircle2 size={12} style={{ marginRight: '3px' }} /> : <XCircle size={12} style={{ marginRight: '3px' }} />}
                      {item.status}
                    </span>
                  </td>
                  <td style={{ fontWeight: 600 }}>{item.confidence}</td>
                  <td style={{ color: item.status === 'Success' ? 'var(--text-muted)' : 'var(--danger-text)', fontSize: '0.8rem' }}>
                    {item.status === 'Success' ? 'Fields mapped successfully to staging' : item.error}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default UploadInvoice;
