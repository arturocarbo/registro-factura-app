import React, { useState, useRef } from 'react';
import { 
  Camera, CheckCircle, AlertCircle, 
  FileText, DollarSign, Calendar, Building, 
  Trash2, Download, Mail, Sparkles 
} from 'lucide-react';
import { GoogleGenAI, Type } from '@google/genai';

export default function App() {
  const [file, setFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedData, setExtractedData] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [activeTab, setActiveTab] = useState('scan');
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const fileInputRef = useRef(null);

  const fileToGenerativePart = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Data = reader.result.split(',')[1];
        resolve({
          inlineData: {
            data: base64Data,
            mimeType: file.type
          }
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const processReceiptWithGemini = async (selectedFile) => {
    setIsProcessing(true);
    setError(null);

    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      
      if (!apiKey || apiKey === 'tu_clave_api_aqui') {
        // Modo simulación si aún no pones la API Key en Vercel
        setTimeout(() => {
          setExtractedData({
            merchant: "Restaurante El Ejemplo S.A.",
            invoiceNumber: "FAC-2026-0891",
            date: new Date().toISOString().split('T')[0],
            totalAmount: 45.50,
            taxAmount: 5.92,
            category: "Alimentación",
            notes: "Almuerzo de trabajo con cliente."
          });
          setIsProcessing(false);
        }, 1500);
        return;
      }

      const ai = new GoogleGenAI({ apiKey });
      const imagePart = await fileToGenerativePart(selectedFile);

      const prompt = "Analiza esta factura. Extrae: comercio/establecimiento, número de factura, fecha (YYYY-MM-DD), monto total, impuesto/IVA, categoría del gasto y observaciones.";

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [prompt, imagePart],
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              merchant: { type: Type.STRING },
              invoiceNumber: { type: Type.STRING },
              date: { type: Type.STRING },
              totalAmount: { type: Type.NUMBER },
              taxAmount: { type: Type.NUMBER },
              category: { type: Type.STRING },
              notes: { type: Type.STRING }
            },
            required: ['merchant', 'date', 'totalAmount']
          }
        }
      });

      const parsedData = JSON.parse(response.text);
      setExtractedData(parsedData);
    } catch (err) {
      console.error(err);
      setError('No se pudo leer la factura. Ingresa los datos manualmente.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setImagePreview(URL.createObjectURL(selectedFile));
      processReceiptWithGemini(selectedFile);
    }
  };

  const handleInputChange = (field, value) => {
    setExtractedData(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveAndSend = () => {
    if (!extractedData) return;

    const newExpense = {
      id: Date.now().toString(),
      ...extractedData,
      status: 'Enviado a SAP'
    };

    setExpenses(prev => [newExpense, ...prev]);

    const sapEmail = import.meta.env.VITE_SAP_EMAIL || 'gastos-sap@tuempresa.com';
    const subject = encodeURIComponent(`[GASTO VENDEDOR] Factura ${extractedData.invoiceNumber || 'S/N'} - ${extractedData.merchant}`);
    const body = encodeURIComponent(
`Hola Equipo Contable / SAP,

Adjunto el registro de factura para procesamiento:

• Comercio: ${extractedData.merchant}
• Nº Factura: ${extractedData.invoiceNumber || 'N/A'}
• Fecha: ${extractedData.date}
• Categoría: ${extractedData.category || 'General'}
• Monto Total: $${Number(extractedData.totalAmount).toFixed(2)}
• Impuestos / IVA: $${Number(extractedData.taxAmount || 0).toFixed(2)}
• Observaciones: ${extractedData.notes || 'Sin notas'}

PAYLOAD JSON PARA SAP:
${JSON.stringify(extractedData, null, 2)}`
    );

    window.location.href = `mailto:${sapEmail}?subject=${subject}&body=${body}`;

    setSuccessMessage('¡Gasto guardado e iniciado el correo!');
    setTimeout(() => setSuccessMessage(''), 4000);

    setFile(null);
    setImagePreview(null);
    setExtractedData(null);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      <header className="bg-blue-700 text-white p-4 shadow-md sticky top-0 z-20">
        <div className="max-w-md mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <FileText className="w-6 h-6" />
            <h1 className="font-bold text-lg">Registro Factura</h1>
          </div>
          <span className="text-xs bg-blue-800 px-2 py-1 rounded-full">SAP Ready</span>
        </div>
      </header>

      <nav className="bg-white border-b border-slate-200">
        <div className="max-w-md mx-auto flex">
          <button 
            onClick={() => setActiveTab('scan')} 
            className={`flex-1 py-3 text-sm font-semibold flex justify-center items-center gap-2 border-b-2 ${
              activeTab === 'scan' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'
            }`}
          >
            <Camera className="w-4 h-4" /> Escanear
          </button>
          <button 
            onClick={() => setActiveTab('history')} 
            className={`flex-1 py-3 text-sm font-semibold flex justify-center items-center gap-2 border-b-2 ${
              activeTab === 'history' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'
            }`}
          >
            <FileText className="w-4 h-4" /> Historial ({expenses.length})
          </button>
        </div>
      </nav>

      <main className="flex-1 max-w-md w-full mx-auto p-4 space-y-4">
        {successMessage && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl flex items-center gap-3 text-sm">
            <CheckCircle className="w-5 h-5 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
        )}

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-xl flex items-center gap-3 text-sm">
            <AlertCircle className="w-5 h-5 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {activeTab === 'scan' ? (
          <div className="space-y-4">
            {!imagePreview ? (
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-blue-300 bg-white rounded-2xl p-8 text-center cursor-pointer hover:border-blue-500 flex flex-col items-center justify-center min-h-[200px]"
              >
                <Camera className="w-10 h-10 text-blue-600 mb-2" />
                <p className="font-semibold text-slate-800">Tomar foto o subir factura</p>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  accept="image/*" 
                  capture="environment"
                  className="hidden" 
                />
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-4 border border-slate-200 space-y-3">
                <div className="relative rounded-xl overflow-hidden bg-slate-900 max-h-56 flex items-center justify-center">
                  <img src={imagePreview} alt="Factura" className="object-contain max-h-56 w-full" />
                  <button 
                    onClick={() => { setImagePreview(null); setExtractedData(null); }}
                    className="absolute top-2 right-2 bg-slate-900/80 text-white p-1.5 rounded-full"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {isProcessing && (
                  <div className="py-4 text-center space-y-2">
                    <Sparkles className="w-6 h-6 text-blue-600 animate-spin mx-auto" />
                    <p className="text-sm font-semibold text-slate-700">Analizando factura con Gemini IA...</p>
                  </div>
                )}
              </div>
            )}

            {extractedData && !isProcessing && (
              <div className="bg-white rounded-2xl p-5 border border-slate-200 space-y-3">
                <h2 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-600" /> Datos Extraídos
                </h2>

                <div>
                  <label className="text-xs font-semibold text-slate-500">Establecimiento</label>
                  <input 
                    type="text" 
                    value={extractedData.merchant || ''} 
                    onChange={(e) => handleInputChange('merchant', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-semibold text-slate-500">Monto Total ($)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      value={extractedData.totalAmount || ''} 
                      onChange={(e) => handleInputChange('totalAmount', e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500">Impuestos / IVA ($)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      value={extractedData.taxAmount || ''} 
                      onChange={(e) => handleInputChange('taxAmount', e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-semibold text-slate-500">Fecha</label>
                    <input 
                      type="date" 
                      value={extractedData.date || ''} 
                      onChange={(e) => handleInputChange('date', e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500">Nº Factura</label>
                    <input 
                      type="text" 
                      value={extractedData.invoiceNumber || ''} 
                      onChange={(e) => handleInputChange('invoiceNumber', e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-500">Categoría</label>
                  <select 
                    value={extractedData.category || 'Otros'} 
                    onChange={(e) => handleInputChange('category', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="Alimentación">Alimentación</option>
                    <option value="Transporte">Transporte / Taxis</option>
                    <option value="Combustible">Combustible</option>
                    <option value="Hospedaje">Hospedaje</option>
                    <option value="Otros">Otros</option>
                  </select>
                </div>

                <button 
                  onClick={handleSaveAndSend}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 shadow mt-2"
                >
                  <Mail className="w-4 h-4" /> Enviar por Correo a SAP
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <h2 className="font-bold text-slate-800 text-sm">Historial de Registros</h2>
            {expenses.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-6">No hay gastos registrados todavía.</p>
            ) : (
              expenses.map(e => (
                <div key={e.id} className="bg-white p-3 rounded-xl border border-slate-200 flex justify-between items-center">
                  <div>
                    <p className="font-bold text-sm text-slate-800">{e.merchant}</p>
                    <p className="text-xs text-slate-500">{e.date} • {e.category}</p>
                  </div>
                  <p className="font-bold text-blue-700">${Number(e.totalAmount).toFixed(2)}</p>
                </div>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}