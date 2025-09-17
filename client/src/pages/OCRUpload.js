import React, { useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  CameraIcon,
  DocumentTextIcon,
  PhotoIcon,
  XMarkIcon,
  CheckIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import LoadingSpinner from '../components/LoadingSpinner';

const OCRUpload = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [ocrResult, setOcrResult] = useState(null);
  const [manualText, setManualText] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('upload');

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target.result);
      reader.readAsDataURL(file);
      setOcrResult(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('Please select a file first');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('image', selectedFile);

      const response = await axios.post('/api/ocr/process', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setOcrResult(response.data.ocrResult);
      toast.success('OCR processing completed!');
    } catch (error) {
      console.error('OCR processing error:', error);
      toast.error('Failed to process image');
    } finally {
      setLoading(false);
    }
  };

  const handleManualText = async () => {
    if (!manualText.trim()) {
      toast.error('Please enter some text');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post('/api/ocr/process-text', {
        text: manualText
      });

      setOcrResult(response.data.ocrResult);
      toast.success('Text processing completed!');
    } catch (error) {
      console.error('Text processing error:', error);
      toast.error('Failed to process text');
    } finally {
      setLoading(false);
    }
  };

  const clearResults = () => {
    setSelectedFile(null);
    setPreview(null);
    setOcrResult(null);
    setManualText('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">OCR Asset Recognition</h2>
        <p className="mt-1 text-sm text-gray-500">
          Upload photos of investment documents or manually enter text to extract asset information
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('upload')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'upload'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <CameraIcon className="h-4 w-4 inline mr-2" />
            Upload Image
          </button>
          <button
            onClick={() => setActiveTab('manual')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'manual'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <DocumentTextIcon className="h-4 w-4 inline mr-2" />
            Manual Text
          </button>
        </nav>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Section */}
        <div className="space-y-6">
          {activeTab === 'upload' ? (
            <div className="card">
              <div className="card-header">
                <h3 className="text-lg font-medium text-gray-900">Upload Document Image</h3>
              </div>
              <div className="card-body">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Image File
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Supported formats: JPG, PNG, GIF, BMP, TIFF (max 10MB)
                    </p>
                  </div>

                  {preview && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Preview
                      </label>
                      <div className="border border-gray-200 rounded-lg p-4">
                        <img
                          src={preview}
                          alt="Preview"
                          className="max-w-full h-auto max-h-64 mx-auto"
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex space-x-3">
                    <button
                      onClick={handleUpload}
                      disabled={!selectedFile || loading}
                      className="btn-primary flex-1"
                    >
                      {loading ? (
                        <div className="flex items-center justify-center">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Processing...
                        </div>
                      ) : (
                        <>
                          <CameraIcon className="h-4 w-4 mr-2" />
                          Process Image
                        </>
                      )}
                    </button>
                    <button
                      onClick={clearResults}
                      className="btn-secondary"
                    >
                      <XMarkIcon className="h-4 w-4 mr-2" />
                      Clear
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="card-header">
                <h3 className="text-lg font-medium text-gray-900">Enter Text Manually</h3>
              </div>
              <div className="card-body">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Document Text
                    </label>
                    <textarea
                      rows="8"
                      className="input"
                      placeholder="Paste or type the text from your investment document here..."
                      value={manualText}
                      onChange={(e) => setManualText(e.target.value)}
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Include any text that might contain ISIN codes, quantities, or prices
                    </p>
                  </div>

                  <div className="flex space-x-3">
                    <button
                      onClick={handleManualText}
                      disabled={!manualText.trim() || loading}
                      className="btn-primary flex-1"
                    >
                      {loading ? (
                        <div className="flex items-center justify-center">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Processing...
                        </div>
                      ) : (
                        <>
                          <DocumentTextIcon className="h-4 w-4 mr-2" />
                          Process Text
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => setManualText('')}
                      className="btn-secondary"
                    >
                      <XMarkIcon className="h-4 w-4 mr-2" />
                      Clear
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Results Section */}
        <div className="space-y-6">
          {ocrResult ? (
            <>
              {/* Extracted Information */}
              <div className="card">
                <div className="card-header">
                  <h3 className="text-lg font-medium text-gray-900">Extracted Information</h3>
                </div>
                <div className="card-body">
                  <div className="space-y-4">
                    {ocrResult.isins.length > 0 && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          ISIN Codes Found
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {ocrResult.isins.map((isin, index) => (
                            <span key={index} className="badge-primary">
                              {isin}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {ocrResult.quantities.length > 0 && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Quantities Found
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {ocrResult.quantities.map((quantity, index) => (
                            <span key={index} className="badge-success">
                              {quantity}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {ocrResult.prices.length > 0 && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Prices Found
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {ocrResult.prices.map((price, index) => (
                            <span key={index} className="badge-warning">
                              ${price}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Confidence Score
                      </label>
                      <div className="flex items-center">
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-primary-600 h-2 rounded-full"
                            style={{ width: `${ocrResult.confidence * 100}%` }}
                          ></div>
                        </div>
                        <span className="ml-3 text-sm text-gray-600">
                          {(ocrResult.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Raw Text */}
              <div className="card">
                <div className="card-header">
                  <h3 className="text-lg font-medium text-gray-900">Raw Extracted Text</h3>
                </div>
                <div className="card-body">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <pre className="text-sm text-gray-700 whitespace-pre-wrap">
                      {ocrResult.text}
                    </pre>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="card">
                <div className="card-body">
                  <div className="space-y-3">
                    <p className="text-sm text-gray-600">
                      Use the extracted information to manually add assets to your portfolios.
                    </p>
                    <div className="flex space-x-3">
                      <button className="btn-primary flex-1">
                        <CheckIcon className="h-4 w-4 mr-2" />
                        Add to Portfolio
                      </button>
                      <button
                        onClick={clearResults}
                        className="btn-secondary"
                      >
                        <XMarkIcon className="h-4 w-4 mr-2" />
                        Clear Results
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="card">
              <div className="card-body">
                <div className="text-center py-12">
                  <PhotoIcon className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No Results Yet</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Upload an image or enter text to see extracted information here.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tips */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-medium text-gray-900">Tips for Better OCR Results</h3>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-gray-900 mb-2">For Image Uploads:</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Use high-resolution images</li>
                <li>• Ensure good lighting and contrast</li>
                <li>• Keep text straight and readable</li>
                <li>• Avoid shadows and reflections</li>
                <li>• Crop to focus on relevant text</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-gray-900 mb-2">For Manual Text:</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Include ISIN codes (12-character format)</li>
                <li>• Mention quantities and share counts</li>
                <li>• Include purchase prices and dates</li>
                <li>• Copy text exactly as shown</li>
                <li>• Include any relevant identifiers</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OCRUpload;