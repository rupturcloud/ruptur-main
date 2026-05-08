import { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { X, Loader2, AlertCircle, Check } from 'lucide-react';

export default function QRScanner({ onScanned, onClose, title = 'Escanear QR Code' }) {
  const scannerRef = useRef(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [deviceId, setDeviceId] = useState(null);
  const [devices, setDevices] = useState([]);
  const qrScannerRef = useRef(null);

  useEffect(() => {
    if (!scannerRef.current) return;

    // Listar dispositivos disponíveis
    Html5QrcodeScanner.getCameras()
      .then((cameras) => {
        setDevices(cameras);
        if (cameras.length > 0) {
          setDeviceId(cameras[0].id);
        }
      })
      .catch((err) => {
        setError('Não foi possível acessar câmeras: ' + err.message);
      });

    // Inicializar scanner
    const scanner = new Html5QrcodeScanner(
      'qr-scanner-container',
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
        disableFlip: false,
        rememberLastUsedCamera: true,
        showTorchButtonIfSupported: true,
      },
      false
    );

    qrScannerRef.current = scanner;
    setIsScanning(true);

    scanner.render(
      (decodedText) => {
        setSuccess(true);
        setIsScanning(false);
        scanner.clear();
        setTimeout(() => onScanned(decodedText), 500);
      },
      (_error) => {
        // Ignorar erros de "não detectado" - é normal
      }
    );

    return () => {
      if (qrScannerRef.current) {
        qrScannerRef.current.clear().catch(() => null);
      }
    };
  }, [onScanned]);

  const handleClose = () => {
    if (qrScannerRef.current) {
      qrScannerRef.current.clear();
    }
    onClose();
  };

  const handleSwitchCamera = (newDeviceId) => {
    setDeviceId(newDeviceId);
    if (qrScannerRef.current) {
      qrScannerRef.current.changeCamera(newDeviceId);
    }
  };

  return (
    <div className="qr-scanner-modal">
      <div className="qr-scanner-overlay" onClick={handleClose} />
      <div className="qr-scanner-container glass">
        <div className="qr-scanner-header">
          <h2>{title}</h2>
          <button className="qr-scanner-close" onClick={handleClose} aria-label="Fechar">
            <X size={24} />
          </button>
        </div>

        {error ? (
          <div className="qr-scanner-error">
            <AlertCircle size={48} />
            <p>{error}</p>
            <button onClick={handleClose} className="neon-btn outline">
              Fechar
            </button>
          </div>
        ) : success ? (
          <div className="qr-scanner-success">
            <div className="success-animation">
              <Check size={64} />
            </div>
            <p>QR Code detectado com sucesso!</p>
          </div>
        ) : isScanning ? (
          <>
            <div id="qr-scanner-container" ref={scannerRef} className="qr-scanner-video" />

            {devices.length > 1 && (
              <div className="qr-scanner-devices">
                <label>Câmera:</label>
                <select value={deviceId || ''} onChange={(e) => handleSwitchCamera(e.target.value)}>
                  {devices.map((device) => (
                    <option key={device.id} value={device.id}>
                      {device.label || `Câmera ${device.id.slice(0, 8)}`}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="qr-scanner-instructions glass">
              <p>Aponte a câmera para o QR code</p>
              <p>Aguardando detecção...</p>
            </div>
          </>
        ) : (
          <div className="qr-scanner-loading">
            <Loader2 size={48} className="spin" />
            <p>Inicializando câmera...</p>
          </div>
        )}

        <style>{`
          .qr-scanner-modal {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            z-index: 9999;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .qr-scanner-overlay {
            position: absolute;
            inset: 0;
            background: rgba(0, 0, 0, 0.8);
            cursor: pointer;
          }

          .qr-scanner-container {
            position: relative;
            z-index: 10000;
            width: min(90vw, 500px);
            max-height: 90vh;
            overflow: hidden;
            border-radius: 24px;
            padding: 24px;
            border: 1px solid rgba(0, 242, 255, 0.2);
          }

          .qr-scanner-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
          }

          .qr-scanner-header h2 {
            margin: 0;
            font-size: 1.4rem;
          }

          .qr-scanner-close {
            background: none;
            border: none;
            color: var(--text-main);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0.7;
            transition: opacity 0.2s;
          }

          .qr-scanner-close:hover {
            opacity: 1;
          }

          #qr-scanner-container {
            width: 100%;
            aspect-ratio: 1;
            border-radius: 16px;
            overflow: hidden;
            margin-bottom: 16px;
            background: rgba(0, 0, 0, 0.2);
          }

          #qr-scanner-container video,
          #qr-scanner-container img {
            width: 100% !important;
            height: 100% !important;
          }

          .qr-scanner-video {
            margin-bottom: 16px;
          }

          .qr-scanner-devices {
            display: flex;
            flex-direction: column;
            gap: 8px;
            margin-bottom: 16px;
          }

          .qr-scanner-devices label {
            font-weight: 600;
            font-size: 0.85rem;
            color: var(--text-muted);
          }

          .qr-scanner-devices select {
            padding: 10px 12px;
            border-radius: 10px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            background: rgba(255, 255, 255, 0.04);
            color: var(--text-main);
            font-size: 0.9rem;
            cursor: pointer;
          }

          .qr-scanner-devices select:focus {
            outline: none;
            border-color: rgba(0, 242, 255, 0.45);
            box-shadow: 0 0 0 3px rgba(0, 242, 255, 0.08);
          }

          .qr-scanner-instructions {
            text-align: center;
            padding: 16px;
            border-radius: 12px;
            background: rgba(0, 242, 255, 0.06);
            border: 1px solid rgba(0, 242, 255, 0.1);
          }

          .qr-scanner-instructions p {
            margin: 4px 0;
            font-size: 0.9rem;
            color: var(--text-muted);
          }

          .qr-scanner-instructions p:first-child {
            color: var(--text-main);
            font-weight: 600;
          }

          .qr-scanner-error,
          .qr-scanner-success,
          .qr-scanner-loading {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 16px;
            padding: 40px 24px;
            min-height: 300px;
          }

          .qr-scanner-error {
            color: #ff7b7b;
          }

          .qr-scanner-error p {
            text-align: center;
            margin: 0;
          }

          .qr-scanner-success {
            color: #00ff88;
          }

          .success-animation {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 100px;
            height: 100px;
            border-radius: 50%;
            background: rgba(0, 255, 136, 0.1);
            animation: pulse 0.6s ease-out;
          }

          @keyframes pulse {
            0% {
              transform: scale(0.8);
              opacity: 1;
            }
            100% {
              transform: scale(1);
              opacity: 1;
            }
          }

          .qr-scanner-loading {
            color: var(--primary);
          }

          .spin {
            animation: spin 1s linear infinite;
          }

          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }

          @media (max-width: 600px) {
            .qr-scanner-container {
              width: 95vw;
              padding: 16px;
            }

            .qr-scanner-header {
              margin-bottom: 16px;
            }

            .qr-scanner-header h2 {
              font-size: 1.2rem;
            }
          }
        `}</style>
      </div>
    </div>
  );
}
