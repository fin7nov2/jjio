import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { QRTokenService } from '../services/qrTokenService';

interface QRScannerProps {
  onScanSuccess: (customerId: string, restaurantId: string, payload: any) => void;
  onClose: () => void;
  restaurantId: string;
  mode?: 'customer' | 'redemption';
}

const QRScanner: React.FC<QRScannerProps> = ({
  onScanSuccess,
  onClose,
  restaurantId,
  mode = 'customer'
}) => {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [processing, setProcessing] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [cameraStarted, setCameraStarted] = useState(false);

  useEffect(() => {
    startScanner();
    return () => {
      stopScanner();
    };
  }, []);

  const startScanner = async () => {
    try {
      setScanning(true);
      setError('');

      const scanner = new Html5Qrcode("qr-reader");
      scannerRef.current = scanner;

      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
      };

      await scanner.start(
        { facingMode: "environment" },
        config,
        onScanSuccess,
        onScanError
      );

      setCameraStarted(true);
    } catch (err: any) {
      console.error('Error starting scanner:', err);
      setError('Failed to start camera. Please ensure camera permissions are granted.');
      setScanning(false);
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current && cameraStarted) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch (err) {
        console.error('Error stopping scanner:', err);
      }
    }
  };

  const onScanSuccess = async (decodedText: string) => {
    if (processing || success) return;

    setProcessing(true);
    setError('');

    try {
      // Stop scanning temporarily
      if (scannerRef.current && cameraStarted) {
        await scannerRef.current.pause(true);
      }

      // Verify the token
      const result = await QRTokenService.verifyAndConsumeToken(decodedText);

      if (!result.valid) {
        setError(result.error || 'Invalid QR code');
        setProcessing(false);
        // Resume scanning after error
        if (scannerRef.current && cameraStarted) {
          await scannerRef.current.resume();
        }
        return;
      }

      // Check if the QR code is for the correct restaurant
      if (result.payload.restaurantId !== restaurantId) {
        setError('QR code is not valid for this restaurant');
        setProcessing(false);
        // Resume scanning after error
        if (scannerRef.current && cameraStarted) {
          await scannerRef.current.resume();
        }
        return;
      }

      // Check mode matches (if redemption QR, payload will have type: 'redemption')
      if (mode === 'redemption' && result.payload.type !== 'redemption') {
        setError('Please scan a reward redemption QR code');
        setProcessing(false);
        if (scannerRef.current && cameraStarted) {
          await scannerRef.current.resume();
        }
        return;
      }

      setSuccess(true);

      // Call success callback with customer and restaurant IDs
      setTimeout(() => {
        onScanSuccess(
          result.payload.customerId,
          result.payload.restaurantId,
          result.payload
        );
      }, 500);
    } catch (err: any) {
      console.error('Error processing QR code:', err);
      setError('Failed to process QR code');
      setProcessing(false);
      // Resume scanning after error
      if (scannerRef.current && cameraStarted) {
        await scannerRef.current.resume();
      }
    }
  };

  const onScanError = (errorMessage: string) => {
    // Ignore scan errors (they happen frequently during scanning)
    // console.log('Scan error:', errorMessage);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl p-6 max-w-md w-full">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-gray-900">
            {mode === 'redemption' ? 'Scan Reward QR Code' : 'Scan Customer QR Code'}
          </h3>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-start gap-2">
            <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            <span>QR code scanned successfully!</span>
          </div>
        )}

        {processing && (
          <div className="mb-4 bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Processing QR code...</span>
          </div>
        )}

        <div className="relative">
          <div
            id="qr-reader"
            className="w-full rounded-xl overflow-hidden bg-black"
            style={{ minHeight: '300px' }}
          />

          {scanning && !processing && !success && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-64 h-64 border-2 border-white rounded-xl shadow-lg" />
            </div>
          )}
        </div>

        <div className="mt-4 text-center">
          <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
            <Camera className="h-4 w-4" />
            <span>Position QR code within the frame</span>
          </div>
          {mode === 'redemption' && (
            <p className="text-xs text-gray-500 mt-2">
              Make sure the customer shows their reward redemption QR code
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default QRScanner;
