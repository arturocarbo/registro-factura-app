import React, { useState, useRef } from 'react';
import { 
  Camera, Upload, CheckCircle, AlertCircle, Send, 
  FileText, DollarSign, Calendar, Building, Tag, 
  Trash2, Download, RefreshCw, Mail, Sparkles, ChevronRight
} from 'lucide-react';
import { GoogleGenAI, Type } from '@google/genai';

export default function App() {
  const [file, setFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedData, setExtractedData] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [activeTab, setActiveTab] = useState('scan'); // 'scan' | 'history'
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const fileInputRef = useRef(null);

  // Convertir archivo a Base64 para Gemini API
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

  // Procesar imagen utilizando la API de Google Gemini
  const processReceiptWithGemini = async (selectedFile) => {
    setIsProcessing(true);
    setError(null);

    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      
      if (!apiKey || apiKey === 'tu_clave_api_aqui') {
        // Modo Simulación si no hay API Key configurada
        setTimeout(() => {
          setExtractedData({
            merchant: "Restaurante El Ejemplo S.A.",
            invoiceNumber: "FAC-2026-0891",
            date: new Date().toISOString().split('T')[0],
            totalAmount: 45.50,
            taxAmount: 5.92,
            category: "Alimentación",
            notes: "Almuerzo de trabajo con cliente potencial."
          });
          setIsProcessing(false);
        }, 2000);
        return;
      }

      const ai = new GoogleGenAI({ apiKey });
      const imagePart = await fileToGenerativePart(selectedFile);

      const prompt = "Analiza esta factura o comprobante de gasto. Extrae la información clave en formato JSON preciso. Incluye comerciante/establecimiento, número de factura/comprobante, fecha (YYYY-MM-DD), monto total con impuestos, monto del impuesto/IVA, categoría del gasto (Alimentación, Transporte, Hospedaje, Combustible, Suministros, Otros) y una breve descripción o nota del consumo.";

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [prompt, imagePart],
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              merchant: { type: Type.STRING, description: 'Nombre de la empresa o comercio' },
              invoiceNumber: { type: Type.STRING, description: 'Número de factura o correlativo' },
              date: { type: Type.STRING, description: 'Fecha en formato YYYY-MM-DD' },
              totalAmount: { type: Type.NUMBER, description: 'Monto total gastado' },
              taxAmount: { type: Type.NUMBER, description: 'Monto de impuestos o IVA' },
              category: { type: Type.STRING, description: 'Categoría del gasto' },
              notes: { type: Type.STRING, description: 'Resumen o concepto del gasto' }
            },
            required: ['merchant', 'date', 'totalAmount']
          }
        }
      });

      const parsedData = JSON.parse(response.text);
      setExtractedData(parsedData);
    } catch (err) {
      console.error('Error al procesar la factura:', err);
      setError('No se pudo procesar la factura con claridad. Por favor verifica la imagen o ingresa los datos manualmente.');
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
      status: 'Enviado a SAP',
      createdAt: new Date().toLocaleString()
    };

    setExpenses(prev => [newExpense, ...prev]);

    // Crear correo pre-completado para enviar a SAP
    const sapEmail = import.meta.env.VITE_SAP_EMAIL || 'gastos-sap@tuempresa.com';
    const subject = encodeURIComponent(`[GASTO VENDEDOR] Factura ${extractedData.invoiceNumber || 'S/N'} - ${extractedData.merchant}`);
    const body = encodeURIComponent(
`Hola Equipo Contable / SAP,

Adjunto el registro de factura de gasto para procesamiento:

--------------------------------------------------
DATOS DEL REGISTRO
--------------------------------------------------
• Comercio/Lugar: ${extractedData.merchant}
• Nº Factura: ${extractedData.invoiceNumber || 'N/A'}
• Fecha: ${extractedData.date}
• Categoría: ${extractedData.category || 'General'}
• Monto Total: $${Number(extractedData.totalAmount).toFixed(2)}
• Impuestos / IVA: $${Number(extractedData.taxAmount || 0).toFixed(2)}
• Notas: ${extractedData.notes || 'Sin observaciones'}

--------------------------------------------------
ESTRUCTURA JSON PARA CARGA AUTOMÁTICA SAP
--------------------------------------------------
${JSON.stringify(extractedData, null, 2)}

Saludos,
Equipo de Ventas.`
    );

    // Abrir cliente de correo predeterminado
    window.location.href = `mailto:${sapEmail}?subject=${subject}&body=${body}`;

    setSuccessMessage('¡Gasto registrado e iniciado el envío por correo!');
    setTimeout(() => setSuccessMessage(''), 4000);

    // Limpiar selección actual
    setFile(null);
    setImagePreview(null);
    setExtractedData(null);
  };

  const exportToCSV = () => {
    if (expenses.length === 0) return;
    const headers = ["ID", "Fecha", "Comercio", "Nº Factura", "Categoría", "Monto Total", "Impuestos", "Notas", "Estado"];
    const rows = expenses.map(e => [
      e.id, e.date, `"${e.merchant}"`, `"${e.invoiceNumber}"`, e.category, e.totalAmount, e.taxAmount, `"${e.notes}"`, e.status
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Reporte_Gastos_SAP_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      {/* Encabezado Superior */}
      <header className="bg-blue-700 text-white p-4 shadow-md sticky top-0 z-20">
        <div className="max-w-md mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <FileText className="w-6 h-6" />
            <h1 className="font-bold text-lg tracking-wide">Registro Factura</h1>
          </div>
          <span className="text-xs bg-blue-800 px-2.5 py-1 rounded-full font-medium">SAP Ready</span>
        </div>
      </header>

      {/* Navegación por Pestañas */}
      <nav className="bg-white border-b border-slate-200">
        <div className="max-w-md mx-auto flex">
          <button 
            onClick={() => setActiveTab('scan')} 
            className={`flex-1 py-3 text-sm font-semibold flex justify-center items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'scan' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'
            }`}
          >
            <Camera className="w-4 h-4" /> Escanear Factura
          </button>
          <button 
            onClick={() => setActiveTab('history')} 
            className={`flex-1 py-3 text-sm font-semibold flex justify-center items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'history' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'
            }`}
          >
            <FileText className="w-4 h-4" /> Historial ({expenses.length})
          </button>
        </div>
      </nav>

      {/* Contenido Principal */}
      <main className="flex-1 max-w-md w-full mx-auto p-4 space-y-4">
        {successMessage && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl flex items-center gap-3 text-sm animate-fade-in">
            <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-xl flex items-center gap-3 text-sm">
            <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {activeTab === 'scan' ? (
          <div className="space-y-4">
            {/* Zona de captura / subida */}
            {!imagePreview ? (
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-blue-300 bg-white rounded-2xl p-8 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50/50 transition-all shadow-sm flex flex-col items-center justify-center min-h-[220px]"
              >
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 mb-4">
                  <Camera className="w-8 h-8" />
                </div>
                <p className="font-semibold text-slate-800 text-base">Tomar foto o cargar factura</p>
                <p className="text-xs text-slate-500 mt-1">Soporta imágenes JPG, PNG o PDF</p>
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
              /* Vista previa e IA Processing */
              <div className="bg-white rounded-2xl p-4 shadow-sm space-y-4 border border-slate-200">
                <div className="relative rounded-xl overflow-hidden bg-slate-900 max-h-56 flex items-center justify-center">
                  <img src={imagePreview} alt="Factura escaneada" className="object-contain max-h-56 w-full" />
                  <button 
                    onClick={() => { setImagePreview(null); setExtractedData(null); }}
                    className="absolute top-2 right-2 bg-slate-900/80 text-white p-1.5 rounded-full hover:bg-slate-900"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {isProcessing && (
                  <div className="py-6 flex flex-col items-center justify-center text-center space-y-3">
                    <Sparkles className="w-8 h-8 text-blue-600 animate-spin" />
                    <p className="text-sm font-semibold text-slate-700">Gemini IA procesando la factura...</p>
                    <p className="text-xs text-slate-500">Extrayendo fecha, monto, proveedor e IVA</p>
                  </div>
                )}
              </div>
            )}

            {/* Formulario con datos extraídos para validación */}
            {extractedData && !isProcessing && (
              <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4 border border-slate-200">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h2 className="font-bold text-slate-800 text-base flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-blue-600" /> Verificación de Datos
                  </h2>
                  <span className="text-xs bg-emerald-100 text-emerald-800 font-medium px-2 py-0.5 rounded-full">
                    Extraído con IA
                  </span>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Comercio / Establecimiento</label>
                    <div className="relative">
                      <Building className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                      <input 
                        type="text" 
                        value={extractedData.merchant || ''} 
                        onChange={(e) => handleInputChange('merchant', e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Monto Total ($)</label>
                      <div className="relative">
                        <DollarSign className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                        <input 
                          type="number" 
                          step="0.01"
                          value={extractedData.totalAmount || ''} 
                          onChange={(e) => handleInputChange('totalAmount', e.target.value)}
                          className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none font-bold text-slate-800"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Impuestos / IVA ($)</label>
                      <input 
                        type="number" 
                        step="0.01"
                        value={extractedData.taxAmount || ''} 
                        onChange={(e) => handleInputChange('taxAmount', e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Fecha</label>
                      <div className="relative">
                        <Calendar className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                        <input 
                          type="date" 
                          value={extractedData.date || ''} 
                          onChange={(e) => handleInputChange('date', e.target.value)}
                          className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Nº Factura</label>
                      <input 
                        type="text" 
                        value={extractedData.invoiceNumber || ''} 
                        onChange={(e) => handleInputChange('invoiceNumber', e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Categoría</label>
                    <select 
                      value={extractedData.category || 'Otros'} 
                      onChange={(e) => handleInputChange('category', e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                    >
                      <option value="Alimentación">Alimentación</option>
                      <option value="Transporte">Transporte / Taxis</option>
                      <option value="Combustible">Combustible</option>
                      <option value="Hospedaje">Hospedaje</option>
                      <option value="Suministros">Suministros de Oficina</option>
                      <option value="Otros">Otros</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Observaciones / Concepto</label>
                    <textarea 
                      rows="2"
                      value={extractedData.notes || ''} 
                      onChange={(e) => handleInputChange('notes', e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      placeholder="Motivo del gasto..."
                    />
                  </div>
                </div>

                <button 
                  onClick={handleSaveAndSend}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 shadow-md transition-all mt-4"
                >
                  <Mail className="w-5 h-5" /> Confirmar y Enviar a SAP
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Pestaña de Historial */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-slate-800 text-base">Registros de Gastos</h2>
              {expenses.length > 0 && (
                <button 
                  onClick={exportToCSV}
                  className="text-xs bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" /> Exportar CSV SAP
                </button>
              )}
            </div>

            {expenses.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center border border-slate-200 text-slate-500">
                <FileText className="w-12 h-12 mx-auto text-slate-300 mb-2" />
                <p className="font-medium text-sm">No hay facturas registradas aún.</p>
                <p className="text-xs mt-1">Usa la pestaña Escanear para ingresar gastos.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {expenses.map((expense) => (
                  <div key={expense.id} className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-bold text-slate-800 text-sm">{expense.merchant}</h3>
                        <p className="text-xs text-slate-500">{expense.date} • {expense.invoiceNumber || 'Sin nº'}</p>
                      </div>
                      <span className="font-extrabold text-blue-700 text-base">
                        ${Number(expense.totalAmount).toFixed(2)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-xs pt-2 border-t border-slate-100">
                      <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium">
                        {expense.category}
                      </span>
                      <span className="text-emerald-600 font-medium flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5" /> {expense.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}