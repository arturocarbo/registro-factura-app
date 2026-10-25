import React, { useState, useEffect } from 'react';
import { 
  Camera, Upload, CheckCircle2, AlertCircle, FileText, Send, 
  Trash2, Download, Filter, DollarSign, Calendar, Building2, 
  RefreshCw, Eye, Mail, Tag, Sparkles, Layers, PieChart, ArrowUpRight, Clock, Plus, Edit2, Key
} from 'lucide-react';

const SAMPLE_RECEIPTS = [
  {
    id: 'DEMO-001',
    fecha: '2026-10-18',
    lugar: 'Restaurante El Portal',
    montoTotal: 45.50,
    iva: 5.23,
    numeroFactura: 'FAC-2026-9041',
    categoria: 'Comida',
    comentarios: 'Almuerzo de trabajo con cliente Key Account',
    estado: 'Enviado a SAP',
    fechaEnvio: '2026-10-18 14:30',
    imagenUrl: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&q=80&w=400'
  }
];

export default function App() {
  const [activeTab, setActiveTab] = useState('scan');
  const [step, setStep] = useState(1);
  
  const [expenses, setExpenses] = useState(() => {
    const saved = localStorage.getItem('sap_expenses_data');
    return saved ? JSON.parse(saved) : SAMPLE_RECEIPTS;
  });

  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState('');

  const [customApiKey, setCustomApiKey] = useState(() => localStorage.getItem('user_gemini_api_key') || '');
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);

  const [formData, setFormData] = useState({
    fecha: new Date().toISOString().split('T')[0],
    lugar: '',
    montoTotal: '',
    iva: '',
    numeroFactura: '',
    categoria: 'Comida',
    comentarios: ''
  });

  const [sapEmail, setSapEmail] = useState(() => localStorage.getItem('sap_email') || 'contabilidad@empresa.com');
  const [vendedorNombre, setVendedorNombre] = useState(() => localStorage.getItem('vendedor_nombre') || 'Carlos Mendoza');
  const [vendedorCodigo, setVendedorCodigo] = useState(() => localStorage.getItem('vendedor_codigo') || 'VEN-8042');

  const [filterCategory, setFilterCategory] = useState('Todas');
  const [filterStatus, setFilterStatus] = useState('Todos');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    localStorage.setItem('sap_expenses_data', JSON.stringify(expenses));
  }, [expenses]);

  useEffect(() => {
    localStorage.setItem('sap_email', sapEmail);
    localStorage.setItem('vendedor_nombre', vendedorNombre);
    localStorage.setItem('vendedor_codigo', vendedorCodigo);
  }, [sapEmail, vendedorNombre, vendedorCodigo]);

  useEffect(() => {
    localStorage.setItem('user_gemini_api_key', customApiKey);
  }, [customApiKey]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
        setStep(1);
      };
      reader.readAsDataURL(file);
    }
  };

  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        let encoded = reader.result.toString().replace(/^data:(.*,)?/, '');
        resolve(encoded);
      };
      reader.onerror = error => reject(error);
    });
  };

  const processReceiptWithAI = async () => {
    if (!imagePreview) return;

    const activeKey = import.meta.env.VITE_GEMINI_API_KEY || customApiKey;
      
    if (!activeKey) {
      setShowApiKeyModal(true);
      return;
    }

    setIsScanning(true);
    setScanProgress('Analizando documento con Inteligencia Artificial...');

    try {
      const base64Data = imageFile ? await fileToBase64(imageFile) : imagePreview.split(',')[1];
      const mimeType = imageFile ? imageFile.type : 'image/jpeg';

      const promptText = "Analiza esta factura o comprobante de gasto. Extrae con precisión rigurosa en formato JSON puro (sin bloques de código markdown extra): {\"lugar\": \"nombre del establecimiento\", \"fecha\": \"YYYY-MM-DD\", \"montoTotal\": 0.00, \"iva\": 0.00, \"numeroFactura\": \"número\", \"categoria\": \"Comida o Hospedaje o Transporte o Combustible u Otros\", \"comentarios\": \"breve descripción\"}";

      // Llamada directa por API REST universal (compatible con llaves AQ... y AIzaSy...)
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${activeKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: promptText },
              {
                inlineData: {
                  mimeType: mimeType,
                  data: base64Data
                }
              }
            ]
          }],
          generationConfig: {
            responseMimeType: "application/json"
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`);
      }

      const data = await response.json();
      const rawText = data.candidates[0].content.parts[0].text;
      
      // Limpieza por si la respuesta trae marcadores de código
      const cleanJson = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);

      setFormData({
        fecha: parsed.fecha || new Date().toISOString().split('T')[0],
        lugar: parsed.lugar || 'Establecimiento No Identificado',
        montoTotal: parsed.montoTotal ? parsed.montoTotal.toString() : '0.00',
        iva: parsed.iva !== undefined ? parsed.iva.toString() : '0.00',
        numeroFactura: parsed.numeroFactura || 'S/N',
        categoria: ['Comida', 'Hospedaje', 'Transporte', 'Combustible', 'Otros'].includes(parsed.categoria) 
          ? parsed.categoria 
          : 'Comida',
        comentarios: parsed.comentarios || 'Gasto operativo de venta'
      });
      setStep(2);
    } catch (err) {
      console.error("Error al procesar la factura:", err);
      alert('Error al conectar con Gemini. Verifica que tu API Key sea válida.');
      setShowApiKeyModal(true);
    } finally {
      setIsScanning(false);
    }
  };

  const handleSaveExpense = (e) => {
    e.preventDefault();
    const newExpense = {
      id: 'EXP-' + Date.now().toString().slice(-6),
      fecha: formData.fecha,
      lugar: formData.lugar,
      montoTotal: parseFloat(formData.montoTotal) || 0,
      iva: parseFloat(formData.iva) || 0,
      numeroFactura: formData.numeroFactura,
      categoria: formData.categoria,
      comentarios: formData.comentarios,
      estado: 'Pendiente',
      fechaEnvio: null,
      imagenUrl: imagePreview || 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&q=80&w=400'
    };

    setExpenses([newExpense, ...expenses]);
    setStep(3);
  };

  const markAsSentAndEmail = (expenseItem) => {
    const updated = expenses.map(exp => {
      if (exp.id === expenseItem.id) {
        return {
          ...exp,
          estado: 'Enviado a SAP',
          fechaEnvio: new Date().toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })
        };
      }
      return exp;
    });
    setExpenses(updated);

    const subject = encodeURIComponent(`[REGISTRO GASTO SAP] ${expenseItem.numeroFactura} - ${vendedorNombre} (${vendedorCodigo})`);
    const body = encodeURIComponent(
`SOLICITUD DE REGISTRO DE FACTURA DE GASTOS - SAP

Dato del Vendedor:
- Vendedor: ${vendedorNombre}
- Código SAP Vendedor: ${vendedorCodigo}

Detalles de la Factura:
------------------------------------------
- ID Registro: ${expenseItem.id}
- Fecha Factura: ${expenseItem.fecha}
- Establecimiento / Lugar: ${expenseItem.lugar}
- N° Factura / Correlativo: ${expenseItem.numeroFactura}
- Categoría de Gasto: ${expenseItem.categoria}
- Monto Total: $${expenseItem.montoTotal.toFixed(2)}
- IVA Aplicable: $${expenseItem.iva ? expenseItem.iva.toFixed(2) : '0.00'}
- Comentarios: ${expenseItem.comentarios || 'N/A'}

---
Estructura JSON para Carga Automática SAP:
{"vendedorId":"${vendedorCodigo}","docNum":"${expenseItem.numeroFactura}","vendor":"${expenseItem.lugar}","date":"${expenseItem.fecha}","total":${expenseItem.montoTotal},"tax":${expenseItem.iva},"category":"${expenseItem.categoria}"}`
    );

    window.open(`mailto:${sapEmail}?subject=${subject}&body=${body}`, '_blank');
  };

  const exportToSAPCSV = () => {
    if (expenses.length === 0) return;
    const headers = ["ID_Registro", "Codigo_Vendedor", "Vendedor", "Fecha_Factura", "Proveedor_Lugar", "Numero_Factura", "Categoria", "Monto_Total", "Monto_IVA", "Estado_SAP"];
    const rows = expenses.map(e => [
      e.id, vendedorCodigo, `"${vendedorNombre}"`, e.fecha, `"${e.lugar}"`, `"${e.numeroFactura}"`, e.categoria, e.montoTotal.toFixed(2), (e.iva || 0).toFixed(2), e.estado
    ]);
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `Export_SAP_Gastos_${vendedorCodigo}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDeleteExpense = (id) => {
    if (confirm('¿Desea eliminar esta factura registrada?')) {
      setExpenses(expenses.filter(item => item.id !== id));
    }
  };

  const filteredExpenses = expenses.filter(exp => {
    const matchesCategory = filterCategory === 'Todas' || exp.categoria === filterCategory;
    const matchesStatus = filterStatus === 'Todos' || exp.estado === filterStatus;
    const matchesSearch = exp.lugar.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          exp.numeroFactura.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesStatus && matchesSearch;
  });

  const totalSpentMonth = expenses.reduce((sum, item) => sum + item.montoTotal, 0);
  const totalPending = expenses.filter(i => i.estado === 'Pendiente').reduce((sum, item) => sum + item.montoTotal, 0);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
      <header className="bg-slate-800/90 backdrop-blur border-b border-slate-700 sticky top-0 z-30 px-4 py-3 shadow-md">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-gradient-to-tr from-blue-600 to-indigo-500 p-2.5 rounded-xl shadow-lg shadow-blue-500/20">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                Registro Factura <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-full font-mono">SAP Connect</span>
              </h1>
              <p className="text-xs text-slate-400">Portal de Gastos de Vendedores</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setShowApiKeyModal(true)} 
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-lg text-xs flex items-center gap-1.5"
              title="Configurar API Key"
            >
              <Key className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">API Key</span>
            </button>
            <div className="hidden sm:flex items-center space-x-3 text-xs bg-slate-900/60 border border-slate-700/80 rounded-lg px-3 py-1.5">
              <div><span className="text-slate-400">Vendedor:</span> <strong className="text-slate-200">{vendedorNombre}</strong></div>
              <div className="h-4 w-[1px] bg-slate-700"></div>
              <div><span className="text-slate-400">Código SAP:</span> <strong className="text-blue-400 font-mono">{vendedorCodigo}</strong></div>
            </div>
          </div>
        </div>
      </header>

      {showApiKeyModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Key className="w-5 h-5 text-amber-400" /> Configurar API Key de Gemini
              </h3>
              <button onClick={() => setShowApiKeyModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <p className="text-xs text-slate-300">
              Ingresa tu clave de Gemini (por ejemplo, la que empieza por <code className="text-blue-400 font-mono">AQ...</code>) para habilitar el escaneo inteligente de facturas:
            </p>
            <input 
              type="password" 
              placeholder="Ej: AQ..." 
              value={customApiKey} 
              onChange={(e) => setCustomApiKey(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-100 font-mono"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button 
                onClick={() => setShowApiKeyModal(false)} 
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl text-xs"
              >
                Guardar y Continuar
              </button>
            </div>
          </div>
        </div>
      )}

      <nav className="bg-slate-800/40 border-b border-slate-800 px-4 py-2">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex space-x-2">
            <button onClick={() => setActiveTab('scan')} className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'scan' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
              <Camera className="w-4 h-4" /><span>Escanear Factura</span>
            </button>
            <button onClick={() => setActiveTab('history')} className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'history' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
              <FileText className="w-4 h-4" /><span>Historial ({expenses.length})</span>
            </button>
            <button onClick={() => setActiveTab('dashboard')} className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'dashboard' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
              <PieChart className="w-4 h-4" /><span>Resumen / SAP</span>
            </button>
          </div>
        </div>
      </nav>

      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {activeTab === 'scan' && (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-2 bg-slate-800/80 p-1.5 rounded-xl border border-slate-700/60 text-center text-xs sm:text-sm font-medium">
              <div className={`py-2 px-1 rounded-lg ${step === 1 ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>1. Foto Factura</div>
              <div className={`py-2 px-1 rounded-lg ${step === 2 ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>2. Revisión IA</div>
              <div className={`py-2 px-1 rounded-lg ${step === 3 ? 'bg-green-600 text-white' : 'text-slate-400'}`}>3. Registro & Envío</div>
            </div>

            {step === 1 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                <div className="bg-slate-800/60 border-2 border-dashed border-slate-700 hover:border-blue-500 rounded-2xl p-6 text-center min-h-[360px] flex flex-col items-center justify-center">
                  {imagePreview ? (
                    <div className="space-y-3">
                      <img src={imagePreview} alt="Factura" className="max-h-[280px] w-auto object-contain rounded-lg border border-slate-700" />
                      <button onClick={() => setImagePreview(null)} className="px-3 py-1 bg-rose-500/20 text-rose-300 rounded-lg text-xs">Quitar Imagen</button>
                    </div>
                  ) : (
                    <>
                      <Camera className="w-12 h-12 text-blue-400 mb-3" />
                      <h3 className="text-base font-semibold text-slate-200 mb-1">Cargar o Tomar Foto de la Factura</h3>
                      <p className="text-xs text-slate-400 mb-4">Asegúrese de que el monto, fecha y lugar sean legibles.</p>
                      <label className="cursor-pointer px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2">
                        <Upload className="w-4 h-4" /> Seleccionar / Tomar Foto
                        <input type="file" accept="image/*" capture="environment" onChange={handleImageChange} className="hidden" />
                      </label>
                    </>
                  )}
                </div>

                <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-6 space-y-4">
                  <h3 className="text-base font-semibold text-slate-200 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-blue-400" /> Extracción Inteligente con IA
                  </h3>
                  <p className="text-xs text-slate-400">El modelo Gemini identificará automáticamente los montos, fecha, comercio e IVA para acelerar tu reporte.</p>
                  <button
                    onClick={processReceiptWithAI}
                    disabled={!imagePreview || isScanning}
                    className={`w-full py-3 px-4 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 transition-all ${
                      imagePreview && !isScanning ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-slate-700 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    {isScanning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    <span>{isScanning ? scanProgress : 'Escanear Documento con IA'}</span>
                  </button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-5 bg-slate-800/80 border border-slate-700 rounded-2xl p-4 flex flex-col items-center">
                  <img src={imagePreview} alt="Factura" className="max-h-[420px] w-auto object-contain rounded-lg p-2" />
                  <button onClick={() => setStep(1)} className="mt-3 text-xs text-blue-400 hover:underline">← Cambiar foto</button>
                </div>

                <div className="lg:col-span-7 bg-slate-800/80 border border-slate-700 rounded-2xl p-6">
                  <h3 className="text-base font-bold text-slate-100 mb-4 flex items-center gap-2">
                    <Edit2 className="w-4 h-4 text-blue-400" /> Verificar & Confirmar Datos
                  </h3>
                  <form onSubmit={handleSaveExpense} className="space-y-4 text-xs">
                    <div>
                      <label className="block text-slate-300 mb-1">Comercio / Establecimiento *</label>
                      <input type="text" required value={formData.lugar} onChange={(e) => setFormData({ ...formData, lugar: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-slate-200" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-300 mb-1">Monto Total ($) *</label>
                        <input type="number" step="0.01" required value={formData.montoTotal} onChange={(e) => setFormData({ ...formData, montoTotal: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-emerald-400 font-bold" />
                      </div>
                      <div>
                        <label className="block text-slate-300 mb-1">IVA / Impuesto ($)</label>
                        <input type="number" step="0.01" value={formData.iva} onChange={(e) => setFormData({ ...formData, iva: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-slate-200" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-300 mb-1">Fecha *</label>
                        <input type="date" required value={formData.fecha} onChange={(e) => setFormData({ ...formData, fecha: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-slate-200" />
                      </div>
                      <div>
                        <label className="block text-slate-300 mb-1">N° Factura / Check *</label>
                        <input type="text" required value={formData.numeroFactura} onChange={(e) => setFormData({ ...formData, numeroFactura: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-slate-200 font-mono" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-slate-300 mb-1">Categoría</label>
                      <select value={formData.categoria} onChange={(e) => setFormData({ ...formData, categoria: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-slate-200">
                        <option value="Comida">Comida / Representación</option>
                        <option value="Hospedaje">Hospedaje</option>
                        <option value="Transporte">Transporte / Peaje</option>
                        <option value="Combustible">Combustible</option>
                        <option value="Otros">Otros Gastos</option>
                      </select>
                    </div>
                    <button type="submit" className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2">
                      <CheckCircle2 className="w-4 h-4" /> Guardar Gasto en App
                    </button>
                  </form>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-6 max-w-lg mx-auto text-center space-y-4">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
                <h3 className="text-lg font-bold text-white">¡Factura Registrada con Éxito!</h3>
                <button onClick={() => markAsSentAndEmail(expenses[0])} className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2">
                  <Mail className="w-4 h-4" /> Enviar Correo a SAP
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-4">
            <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-4 flex flex-col md:flex-row gap-3 justify-between">
              <input type="text" placeholder="Buscar comercio..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200" />
              <button onClick={exportToSAPCSV} className="px-3 py-2 bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1">
                <Download className="w-3.5 h-3.5" /> Exportar CSV SAP
              </button>
            </div>
            <div className="space-y-3">
              {filteredExpenses.map(exp => (
                <div key={exp.id} className="bg-slate-800 p-4 rounded-2xl border border-slate-700 flex justify-between items-center text-xs">
                  <div>
                    <h4 className="font-bold text-white text-sm">{exp.lugar}</h4>
                    <p className="text-slate-400">{exp.fecha} • {exp.numeroFactura} • {exp.categoria}</p>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-emerald-400 text-sm font-mono">${exp.montoTotal.toFixed(2)}</span>
                    <button onClick={() => handleDeleteExpense(exp.id)} className="block text-rose-400 ml-auto mt-1"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'dashboard' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700">
              <div className="text-xs text-slate-400">Total Gastado</div>
              <div className="text-2xl font-bold text-white font-mono">${totalSpentMonth.toFixed(2)}</div>
            </div>
            <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700">
              <div className="text-xs text-slate-400">Pendiente de Envío</div>
              <div className="text-2xl font-bold text-amber-400 font-mono">${totalPending.toFixed(2)}</div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
