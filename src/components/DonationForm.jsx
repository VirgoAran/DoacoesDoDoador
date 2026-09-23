import React, { useState, useEffect, useCallback } from 'react';
import { Search, Save, Trash2, Edit2, SkipBack, SkipForward, ChevronLeft, ChevronRight, Plus, X, CheckCircle, AlertTriangle, FileText, Package, Truck, Calendar, MapPin, User, Users, Info, ArrowRight } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { registerLog } from '../utils/logger';
import { useAuth } from '../contexts/AuthContext';
import QuickPrintModal from './QuickPrintModal.jsx';
import { toLocalIsoDate } from '../utils/date';

const toDateInputValue = (value) => {
    if (!value) return '';
    const str = String(value);
    return str.length >= 10 ? str.slice(0, 10) : str;
};

const toDbDate = (value) => {
    if (!value) return null;
    const str = String(value).trim();
    return str === '' ? null : str;
};

const Toast = ({ message, type, onClose }) => {
    useEffect(() => { const timer = setTimeout(onClose, 3000); return () => clearTimeout(timer); }, [onClose]);
    return (
        <div className={`toast toast-${type}`}>
            {type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
            <span>{message}</span>
            <button className="toast-close" onClick={onClose}><X size={14} /></button>
        </div>
    );
};

const ConfirmModal = ({ message, onConfirm, onCancel }) => (
    <div className="modal-overlay">
        <div className="modal-box">
            <div className="modal-icon"><AlertTriangle size={48} color="#ef4444" /></div>
            <p className="modal-message">{message}</p>
            <div className="modal-actions">
                <button className="btn-action btn-danger" onClick={onConfirm}>Confirmar Exclusão</button>
                <button className="btn-action btn-secondary" onClick={onCancel}><X size={16} /> Cancelar</button>
            </div>
        </div>
    </div>
);

const SelectDonorModal = ({ onClose, onSelect }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [donors, setDonors] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchDonors = async () => {
            setLoading(true);
            try {
                let query = supabase.from('doadores').select('codigo_doador, nome, regiao, dia_semana, cep, endereco, logradouro, complemento, bairro, cidade, estado, mapa, contato, fixo, celular, whatsapp').order('nome').limit(50);
                if (searchTerm) {
                    query = query.ilike('nome', `%${searchTerm}%`);
                }
                const { data, error } = await query;
                if (error) throw error;
                setDonors(data || []);
            } catch (error) {
                console.error("Erro ao buscar doadores", error);
            } finally {
                setLoading(false);
            }
        };
        const timer = setTimeout(() => {
            fetchDonors();
        }, 300);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    return (
        <div className="modal-overlay">
            <div className="modal-box" style={{ maxWidth: '500px', padding: '30px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', color: 'var(--primary-color)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Users size={24} />
                        <h3 style={{ margin: 0, fontWeight: 900 }}>Selecionar Doador</h3>
                    </div>
                    <button className="btn-action btn-secondary" style={{ padding: '5px' }} onClick={onClose}><X size={18} /></button>
                </div>
                
                <div className="form-group" style={{ marginBottom: '15px' }}>
                    <input 
                        className="input-field" 
                        placeholder="Filtrar por nome..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        autoFocus
                    />
                </div>
                
                <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                    {loading ? (
                        <div style={{ padding: '15px', textAlign: 'center', opacity: 0.6 }}>Buscando...</div>
                    ) : donors.length > 0 ? (
                        <table className="donation-items-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <tbody>
                                {donors.map(donor => (
                                    <tr key={donor.codigo_doador} onClick={() => { onSelect(donor); onClose(); }} style={{ cursor: 'pointer' }}>
                                        <td style={{ width: '60px', textAlign: 'center', fontWeight: 'bold', color: 'var(--primary-color)' }}>{donor.codigo_doador}</td>
                                        <td>{donor.nome}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div style={{ padding: '15px', textAlign: 'center', opacity: 0.6 }}>Nenhum doador encontrado.</div>
                    )}
                </div>
            </div>
        </div>
    );
};

const UNIDADES_PADRAO = ["UN", "KG", "PÇ", "LT", "MT", "PCT", "CX", "DZ", "SAC", "PAR"];

const AddItemModal = ({ onAdd, onClose, categories }) => {
    const [selectedCategory, setSelectedCategory] = useState('');
    const [selectedItem, setSelectedItem] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [unit, setUnit] = useState('UN');
    const [extraUnits, setExtraUnits] = useState(() => {
        try {
            const saved = localStorage.getItem('inv_extra_units');
            return saved ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    });

    const recordUnit = (val) => {
        if (!val) return;
        const u = val.trim().toUpperCase();
        if (!UNIDADES_PADRAO.includes(u) && !extraUnits.includes(u)) {
            const next = [...extraUnits, u];
            setExtraUnits(next);
            localStorage.setItem('inv_extra_units', JSON.stringify(next));
        }
    };
    const [availableItems, setAvailableItems] = useState([]);
    const [customItem, setCustomItem] = useState('');

    useEffect(() => {
        const load = async () => {
            if (!selectedCategory) {
                setAvailableItems([]);
                return;
            }
            const baseStr = String(selectedCategory).trim();
            const { data, error } = await supabase.from('itens').select('codigo_completo, nome, unidade').eq('codigo_base', baseStr).order('nome');
            if (error) console.error('Erro ao carregar itens da categoria', baseStr, error);
            setAvailableItems(data || []);
        };
        load();
    }, [selectedCategory]);

    const handleAdd = () => {
        const itemNome = selectedItem === 'Outro' ? customItem : selectedItem;
        if (itemNome && quantity > 0) {
            const catObj = categories.find(c => String(c.codigo_base) === String(selectedCategory));
            const foundItem = availableItems.find(x => x.nome === itemNome);
            onAdd({ item: itemNome, qtde: quantity, categoria: catObj?.nome || 'Geral', unidade: unit, codigo_item: foundItem?.codigo_completo || '' });
            onClose();
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-box" style={{maxWidth: '450px', padding: '30px'}}>
                <div style={{display:'flex', alignItems:'center', gap:'10px', marginBottom:'20px', color:'var(--primary-color)'}}>
                    <Package size={24} />
                    <h3 style={{margin:0, fontWeight:900}}>Adicionar Item</h3>
                </div>
                
                <div className="form-group" style={{marginBottom:'15px'}}>
                    <label style={{fontSize:'0.75rem', fontWeight:700, marginBottom:'5px', display:'block'}}>Categoria</label>
                    <select className="input-field" value={selectedCategory} onChange={e => {setSelectedCategory(e.target.value); setSelectedItem('');}}>
                        <option value="">Selecione a Categoria...</option>
                        {categories.map(c => <option key={c.codigo_base} value={c.codigo_base}>{c.nome}</option>)}
                    </select>
                </div>

                <div className="form-group" style={{marginBottom:'15px'}}>
                    <label style={{fontSize:'0.75rem', fontWeight:700, marginBottom:'5px', display:'block'}}>Item</label>
                    <select className="input-field" value={selectedItem} onChange={e => {
                        setSelectedItem(e.target.value);
                        if(e.target.value !== 'Outro') {
                            const it = availableItems.find(x => x.nome === e.target.value);
                            if(it?.unidade) setUnit(it.unidade);
                        }
                    }} disabled={!selectedCategory}>
                        <option value="">Selecione o Item...</option>
                        {availableItems.map((it, i) => <option key={i} value={it.nome}>{it.nome}</option>)}
                        <option value="Outro">+ Digitar manualmente...</option>
                    </select>
                </div>

                {selectedItem === 'Outro' && (
                    <div className="form-group" style={{marginBottom:'15px'}}>
                        <label style={{fontSize:'0.75rem', fontWeight:700, marginBottom:'5px', display:'block'}}>Descrever Item Novo</label>
                        <input className="input-field" value={customItem} onChange={e => setCustomItem(e.target.value)} placeholder="Ex: Cadeira de Rodas..." autoFocus />
                    </div>
                )}

                <div style={{display:'flex', gap:'10px', marginBottom:'25px'}}>
                    <div className="form-group" style={{flex: 1, minWidth: 0}}>
                        <label style={{fontSize:'0.75rem', fontWeight:700, marginBottom:'5px', display:'block'}}>Quantidade</label>
                        <input type="number" className="input-field" value={quantity} onChange={e => setQuantity(Number(e.target.value))} min="1" />
                    </div>
                    <div className="form-group" style={{flex: 1, minWidth: 0}}>
                        <label style={{fontSize:'0.75rem', fontWeight:700, marginBottom:'5px', display:'block'}}>Unidade</label>
                        <input 
                            className="input-field" 
                            value={unit} 
                            onChange={e => setUnit(e.target.value.toUpperCase())} 
                            onKeyDown={e => {
                                if (e.key === 'Enter') {
                                    recordUnit(e.target.value);
                                }
                            }}
                            onBlur={e => recordUnit(e.target.value)}
                            list="unidades-doacao-list"
                            placeholder="UN" 
                            maxLength={10} 
                            autoComplete="off"
                        />
                        <datalist id="unidades-doacao-list">
                            {UNIDADES_PADRAO.map(u => <option key={u} value={u} />)}
                            {extraUnits.filter(u => !UNIDADES_PADRAO.includes(u)).map(u => <option key={u} value={u} />)}
                        </datalist>
                    </div>
                </div>

                <div className="modal-actions" style={{marginTop:'10px'}}>
                    <button className="btn-action btn-primary" style={{flex:1}} onClick={handleAdd} disabled={!selectedCategory || !((selectedItem && selectedItem !== 'Outro') || customItem)}><Plus size={18} /> Adicionar à Lista</button>
                    <button className="btn-action btn-secondary" onClick={onClose}><X size={18} /> Cancelar</button>
                </div>
            </div>
        </div>
    );
};

const DonationForm = ({ initialDonor }) => {
    const { user, perfil, isTransportes, isAdmin, isDoacoes } = useAuth();
    const canEdit = (isAdmin || isDoacoes) && !isTransportes;
    const [formData, setFormData] = useState({
        codigo_doacao: '', codigo_doador: '', doador_nome: '', doadores: {}, data_doacao: '', data_retirada: '',
        status: 'Pendente', observacoes: '', itens: [],
        remarcado_para: '', responsavel: ''
    });
    const [currentIndex, setCurrentIndex] = useState(-1);
    const [totalRecords, setTotalRecords] = useState(0);
    const [isEditing, setIsEditing] = useState(false);
    const [isNew, setIsNew] = useState(false);
    const [loading, setLoading] = useState(false);
    const [searchQuery] = useState('');
    const [toast, setToast] = useState(null);
    const [showConfirmDelete, setShowConfirmDelete] = useState(false);
    const [showAddItemModal, setShowAddItemModal] = useState(false);
    const [showDonorModal, setShowDonorModal] = useState(false);
    const [showQuickPrint, setShowQuickPrint] = useState(false);
    const [categories, setCategories] = useState([]);
    const [responsaveis, setResponsaveis] = useState([]);

    const showToast = useCallback((message, type = 'success') => setToast({ message, type }), []);

    const fetchDonation = useCallback(async (index = 0, search = false) => {
        setLoading(true);
        try {
            let query = supabase.from('doacoes').select('*, doadores(nome, regiao, cep, endereco, logradouro, complemento, bairro, cidade, estado, mapa, contato, fixo, celular, whatsapp)', { count: 'planned' });
            if (search && searchQuery) {
                if (!isNaN(searchQuery) && searchQuery.length <= 6) {
                    query = query.eq('codigo_doacao', String(searchQuery).padStart(6, '0'));
                } else {
                    query = query.or(`observacoes.ilike.%${searchQuery}%,status.ilike.%${searchQuery}%`);
                }
            }
            query = query.order('codigo_doacao', { ascending: false }).range(index, index);
            const { data, count, error } = await query;
            if (error) throw error;
            if (data?.length > 0) {
                const codes = data.map(d => d.codigo_doacao);
                const { data: allItens } = await supabase.from('itens_doacao').select('*').in('id_doacao', codes);
                const itensByCode = {};
                (allItens || []).forEach(item => {
                    if (!itensByCode[item.id_doacao]) itensByCode[item.id_doacao] = [];
                    itensByCode[item.id_doacao].push(item);
                });
                data.forEach(d => { d.itens_doacao = itensByCode[d.codigo_doacao] || []; });
                const d = data[0];
                setFormData({
                    codigo_doacao: d.codigo_doacao, codigo_doador: d.codigo_doador, doador_nome: d.doadores?.nome || '', doadores: d.doadores || {},
                    data_doacao: toDateInputValue(d.data_doacao), data_retirada: toDateInputValue(d.data_retirada), status: d.status,
                    observacoes: d.observacoes, itens: d.itens_doacao || [],
                    remarcado_para: toDateInputValue(d.remarcado_para), responsavel: d.responsavel || ''
                });
                setCurrentIndex(index);
                setTotalRecords(count || 0);
                setIsEditing(false);
            } else if (search) { showToast('Doação não encontrada.', 'error'); }
        } catch (e) { console.error(e); } finally { setLoading(false); }
    }, [searchQuery, showToast]);

    const generateNextDonationCode = useCallback(async () => {
        try {
            // Busca os últimos 1000 registros ordenados decrescente para encontrar o maior número real
            const { data, error } = await supabase.from('doacoes').select('codigo_doacao').order('codigo_doacao', { ascending: false }).limit(1000);
            if (error) throw error;
            
            let maxVal = 0;
            if (data && data.length > 0) {
                data.forEach(d => {
                    const val = parseInt(d.codigo_doacao);
                    if (!isNaN(val) && val > maxVal) maxVal = val;
                });
            }
            return String(maxVal + 1).padStart(6, '0');
        } catch (e) {
            console.error('Erro ao gerar código:', e);
            return '000001';
        }
    }, []);

    const fetchAuxData = useCallback(async () => {
        try {
            const { data: cData, error: catError } = await supabase.from('categoria').select('codigo_base, nome').order('nome');
            if (catError) console.error('Erro ao carregar categorias:', catError);
            
            // Busca responsáveis únicos já cadastrados nas doações
            // Limitado + ordenado para evitar transferir a tabela inteira
            const { data: respData } = await supabase.from('doacoes').select('responsavel').order('codigo_doacao', { ascending: false }).limit(2000);
            
            setCategories(cData || []);
            if (!cData || cData.length === 0) console.warn('Categorias vazias - verifique RLS/autenticação', catError);
            
            const baseNames = ["Adelaide", "Auro", "Elisângela", "Helenice", "José Luiz", "Tatyane", "Shirley"];
            
            if (respData) {
                // Limpeza EXTREMA para comparar duplicatas: remove tudo que não for letra ou número
                // Isso garante que " José  Luiz ", "José Luiz", "Jose Luiz", etc., se tornem "JOSELUIZ".
                const normalize = (s) => {
                    if (!s) return '';
                    return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
                };
                
                const seen = new Set();
                const combined = [];

                // Adiciona primeiro os nomes base (preferenciais)
                baseNames.forEach(name => {
                    const norm = normalize(name);
                    if (!seen.has(norm)) {
                        seen.add(norm);
                        combined.push(name.trim());
                    }
                });

                // Adiciona nomes do banco que não estejam nos nomes base
                respData.forEach(r => {
                    const name = r.responsavel;
                    if (name) {
                        const norm = normalize(name);
                        if (!seen.has(norm)) {
                            seen.add(norm);
                            combined.push(name.trim());
                        }
                    }
                });

                setResponsaveis(combined.sort((a, b) => a.localeCompare(b)));
            } else {
                setResponsaveis(baseNames.sort((a, b) => a.localeCompare(b)));
            }
        } catch (e) { console.error('Erro ao buscar dados auxiliares:', e); }
    }, []);

    useEffect(() => {
        const init = async () => {
            await fetchAuxData();
            if (initialDonor) {
                const nextCode = await generateNextDonationCode();
                setFormData({
                    codigo_doacao: nextCode,
                    codigo_doador: initialDonor.codigo || initialDonor.codigo_doador || '',
                    doador_nome: initialDonor.nome || '',
                    doadores: initialDonor || {},
                    data_doacao: toLocalIsoDate(),
                    data_retirada: '',
                    status: 'Pendente',
                    itens: [],
                    observacoes: '',
                    remarcado_para: '',
                    responsavel: ''
                });
                setIsNew(true);
                setIsEditing(true);
            } else {
                // Ao abrir pelo menu lateral, inicia vazio mas busca o total de registros para navegação
                try {
                    const { count } = await supabase.from('doacoes').select('*', { count: 'planned', head: true });
                    setTotalRecords(count || 0);
                    setCurrentIndex(-1); // Indica que nenhum registro está carregado
                    setFormData({
                        codigo_doacao: '', codigo_doador: '', doador_nome: '', doadores: {}, data_doacao: '', data_retirada: '',
                        status: 'Pendente', observacoes: '', itens: [],
                        remarcado_para: '', responsavel: ''
                    });
                } catch (e) { console.error('Erro ao buscar contagem:', e); }
            }
        };
        init();
    }, [initialDonor, fetchAuxData, generateNextDonationCode]);

    const handleSave = async (e) => {
        if (e) e.preventDefault();
        if (loading) return; // Evita duplo clique (proteção contra Duplicate Key)
        if (!formData.responsavel?.trim()) {
            showToast('O campo RESPONSÁVEL é obrigatório.', 'error');
            setLoading(false);
            return;
        }
        if (!formData.codigo_doador?.toString().trim()) {
            showToast('Selecione um DOADOR antes de salvar.', 'error');
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const rawDigits = String(formData.codigo_doador).trim().replace(/\D/g, '');
            const numericCode = parseInt(rawDigits, 10);
            if (!rawDigits || isNaN(numericCode)) {
                showToast('Código do doador inválido. Selecione um doador.', 'error');
                setLoading(false);
                return;
            }

            const { data: donorLookup, error: lookupError } = await supabase
                .from('doadores')
                .select('codigo_doador')
                .eq('codigo_doador', numericCode)
                .maybeSingle();

            if (lookupError) {
                console.error('Erro ao buscar doador:', lookupError);
                showToast('Erro ao buscar doador: ' + lookupError.message, 'error');
                setLoading(false);
                return;
            }

            let donorCode = donorLookup?.codigo_doador;

            if (!donorCode) {
                const donorData = formData.doadores || {};
                const { data: newDonor, error: donorError } = await supabase
                    .from('doadores')
                    .upsert({
                        codigo_doador: numericCode,
                        nome: donorData.nome || formData.doador_nome || '',
                        celular: donorData.celular || '',
                        fixo: donorData.fixo || '',
                        whatsapp: donorData.whatsapp || '',
                        email: donorData.email || '',
                        contato: donorData.contato || '',
                        cep: (donorData.cep || '').replace(/\D/g, ''),
                        logradouro: donorData.logradouro || '',
                        endereco: donorData.endereco || '',
                        complemento: donorData.complemento || '',
                        bairro: donorData.bairro || '',
                        cidade: donorData.cidade || '',
                        estado: donorData.estado || '',
                        regiao: donorData.regiao || '',
                        dia_semana: donorData.dia_semana || ''
                    }, { onConflict: 'codigo_doador' })
                    .select('codigo_doador')
                    .maybeSingle();
                if (donorError || !newDonor) {
                    console.error('Erro ao sincronizar doador:', donorError);
                    showToast('Erro ao sincronizar doador: ' + (donorError?.message || 'Tente novamente.'), 'error');
                    setLoading(false);
                    return;
                }
                donorCode = newDonor.codigo_doador;
            }

            let finalizedCode = formData.codigo_doacao;

            const dbData = {
                codigo_doador: donorCode,
                data_doacao: toDbDate(formData.data_doacao),
                data_retirada: toDbDate(formData.data_retirada), status: formData.status,
                observacoes: formData.observacoes,
                remarcado_para: toDbDate(formData.remarcado_para),
                responsavel: formData.responsavel
            };
            let error;
            let res;
            if (isNew) {
                // Retry automático em caso de colisão de código único (concorrência)
                let attempts = 0;
                while (attempts < 5) {
                    attempts++;
                    if (!finalizedCode || attempts > 1) finalizedCode = await generateNextDonationCode();
                    res = await supabase.from('doacoes').insert([{ ...dbData, codigo_doacao: finalizedCode }]).select('codigo_doacao');
                    error = res.error;
                    if (!error) break;
                    if (error.code !== '23505') break;
                    finalizedCode = null; // força gerar novo código na próxima tentativa
                }
                if (attempts >= 5 && !error) error = { message: 'Não foi possível gerar um código único após várias tentativas. Tente novamente.' };
            } else {
                res = await supabase.from('doacoes').update(dbData).eq('codigo_doacao', finalizedCode).select('codigo_doacao');
                error = res.error;
            }
            if (error) throw error;
            
            // Sucesso na gravação da doação -> não é mais registro "Novo"
            const donationId = res.data[0].codigo_doacao;
            setIsNew(false);
            setCurrentIndex(0); // Garante que a UI aponte para o novo (ou primeiro) registro

            // Salvar itens
            if (isEditing) {
                // Se for edição, remove os itens antigos antes (abordagem simples para sincronização)
                await supabase.from('itens_doacao').delete().eq('id_doacao', donationId);
            }

            if (formData.itens.length > 0) {
                const itensToInsert = formData.itens.map(it => ({
                    id_doacao: donationId,
                    item: it.item,
                    qtde: it.qtde,
                    categoria: it.categoria || 'Geral',
                    unidade: it.unidade || 'UN',
                    codigo_item: it.codigo_item || ''
                }));
                const { error: errorItens } = await supabase.from('itens_doacao').insert(itensToInsert);
                if (errorItens) {
                    console.error('Erro nos itens:', errorItens);
                    throw new Error('A doação foi salva, mas ocorreu um erro ao salvar os itens: ' + errorItens.message + '. Verifique se a coluna "codigo_item" existe na tabela itens_doacao no Supabase.');
                }
            }

            await registerLog({
                usuario_email: user?.email || '',
                acao: isNew ? 'Inclusão' : 'Alteração',
                modulo: 'Doações',
                detalhes: isNew ? `Nova doação para doador ${formData.codigo_doador}` : `Doação ${formData.codigo_doacao} alterada`
            });
            showToast('Doação salva com sucesso!');
            setIsEditing(false); 
            fetchDonation(0);
        } catch (e) { showToast('Erro ao salvar doação: ' + e.message, 'error'); } finally { setLoading(false); }
    };
    
    const handleResponsavelSmart = (name) => {
        if (!name) return;
        const trimmed = name.trim();
        if (trimmed && !responsaveis.some(r => r.toLowerCase() === trimmed.toLowerCase())) {
            // Adiciona localmente para feedback imediato; será "persistido" quando a doação for salva
            setResponsaveis(prev => [...prev, trimmed].sort());
        }
    };

    return (
        <div className="main-content-layout" style={{ flexDirection: 'column' }}>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            {showConfirmDelete && <ConfirmModal message={`Excluir doação ${formData.codigo_doacao}?`} onConfirm={async () => {
                await supabase.from('doacoes').delete().eq('codigo_doacao', formData.codigo_doacao);
                await registerLog({
                    usuario_email: user?.email || '',
                    acao: 'Exclusão',
                    modulo: 'Doações',
                    detalhes: `Doação ${formData.codigo_doacao} excluída (Doador: ${formData.doador_nome})`
                });
                showToast('Doação removida.'); setShowConfirmDelete(false); fetchDonation(0);
            }} onCancel={() => setShowConfirmDelete(false)} />}

            <div className="donor-card">

                <div className="nav-bar" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '15px' }}>
                    <div className="nav-controls">
                        <button className="btn-nav" onClick={() => fetchDonation(0)} disabled={(currentIndex <= 0 && currentIndex !== -1) || loading || totalRecords === 0}><SkipBack size={18} /></button>
                        <button className="btn-nav" onClick={() => fetchDonation(currentIndex === -1 ? 0 : currentIndex - 1)} disabled={(currentIndex <= 0 && currentIndex !== -1) || loading || totalRecords === 0}><ChevronLeft size={18} /></button>
                        <span className="nav-counter">{(totalRecords === 0 || currentIndex === -1) ? '0 / 0' : `${currentIndex + 1} / ${totalRecords}`}</span>
                        <button className="btn-nav" onClick={() => fetchDonation(currentIndex === -1 ? 0 : currentIndex + 1)} disabled={currentIndex >= totalRecords - 1 || loading || totalRecords === 0}><ChevronRight size={18} /></button>
                        <button className="btn-nav" onClick={() => fetchDonation(totalRecords - 1)} disabled={currentIndex >= totalRecords - 1 || loading || totalRecords === 0}><SkipForward size={18} /></button>
                    </div>
                    <div className="nav-actions" style={{ flex: '1 1 auto', display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: '10px' }}>
                        {!isEditing && (
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                <button className="btn-action btn-success" style={{ flexShrink: 0 }} onClick={async () => {
                                    const nextCode = await generateNextDonationCode();
                                    setIsNew(true); setIsEditing(true);
                                    setFormData({ codigo_doacao: nextCode, codigo_doador: '', doador_nome: '', data_doacao: toLocalIsoDate(), status: 'Pendente', itens: [], observacoes: '', remarcado_para: '', responsavel: '' });
                                }} disabled={!canEdit}><Plus size={18} /> Novo</button>
                                <button className="btn-action btn-primary" style={{ flexShrink: 0 }} onClick={() => setIsEditing(true)} disabled={totalRecords === 0 || !canEdit}><Edit2 size={18} /> Alterar</button>
                                <button className="btn-action btn-danger" style={{ flexShrink: 0 }} onClick={() => setShowConfirmDelete(true)} disabled={totalRecords === 0 || !canEdit}><Trash2 size={18} /> Excluir</button>

                                <div style={{ display: 'flex', gap: '5px', flexShrink: 0 }}>
                                    <button className="btn-action" style={{ backgroundColor: '#6b7280', color: 'white', display: 'flex', alignItems: 'center', gap: '5px', padding: '0 12px', height: '38px', borderRadius: 0, border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }} onClick={() => setShowQuickPrint(true)} disabled={totalRecords === 0} title="Imprimir Doações">
                                        <FileText size={16} /> <span>IMPRIMIR DOAÇÕES</span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="premium-wrapper" style={{ display: 'block' }}>
                    <div className="glass-card" style={{ padding: '30px', marginBottom: '30px' }}>
                        <div className="section-title-premium" style={{ marginTop: 0 }}>Doador: <span style={{ color: 'var(--primary-color)' }}>{formData.doador_nome || '(Selecione um Doador)'}</span></div>

                        {/* Row 1: Codigo, Cod Doador, Botao Doador, Nome */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto 2fr', gap: '20px', marginBottom: '20px', alignItems: 'end' }}>
                            <div className="form-group"><label>CÓDIGO</label><input className="input-field input-readonly" value={formData.codigo_doacao || '---'} readOnly /></div>
                            <div className="form-group"><label>CÓD. DOADOR</label><input className="input-field input-readonly" value={formData.codigo_doador} readOnly /></div>
                            <div className="form-group" style={{ paddingBottom: '3px' }}>
                                <button type="button" className="btn-action btn-primary" style={{ height: '42px', width: '42px', padding: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', borderRadius: '8px' }} onClick={(e) => { e.preventDefault(); setShowDonorModal(true); }} disabled={!isEditing} title="Selecionar Doador">
                                    <Users size={20} />
                                </button>
                            </div>
                            <div className="form-group"><label>NOME</label><input className="input-field input-readonly" value={formData.doador_nome} readOnly /></div>
                        </div>

                        {/* Row 2: Data Doação, Data Retirada, Remarcado Para, Responsável */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '20px' }}>
                            <div className="form-group"><label>DATA DOAÇÃO</label><input type="date" className="input-field" value={formData.data_doacao} readOnly={!isEditing} onChange={e => setFormData({ ...formData, data_doacao: e.target.value })} /></div>
                            <div className="form-group"><label>DATA RETIRADA</label><input type="date" className="input-field" value={formData.data_retirada} readOnly={!isEditing} onChange={e => setFormData({ ...formData, data_retirada: e.target.value })} /></div>
                            <div className="form-group"><label>REMARCADO PARA</label><input type="date" className="input-field" value={formData.remarcado_para} readOnly={!isEditing} onChange={e => setFormData({ ...formData, remarcado_para: e.target.value })} /></div>
                            <div className="form-group">
                                <label>RESPONSÁVEL</label>
                                <input 
                                    className="input-field" 
                                    value={formData.responsavel} 
                                    readOnly={!isEditing} 
                                    onChange={e => setFormData({ ...formData, responsavel: e.target.value })} 
                                    onKeyDown={e => {
                                        if (e.key === 'Enter' || e.key === 'Tab') {
                                            handleResponsavelSmart(formData.responsavel);
                                        }
                                    }}
                                    list="responsavel-list"
                                    required
                                />
                                <datalist id="responsavel-list">
                                    {responsaveis.map((r, i) => <option key={i} value={r} />)}
                                </datalist>
                            </div>
                        </div>

                        {/* Row 3: Status, Observações */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 3fr', gap: '20px', marginBottom: '20px' }}>
                            <div className="form-group">
                                <label>STATUS</label>
                                <select className="input-field" value={formData.status} disabled={!isEditing} onChange={e => setFormData({ ...formData, status: e.target.value })}>
                                    <option value="Pendente">Pendente</option>
                                    <option value="Baixada">Baixada</option>
                                    <option value="Remarcada">Remarcada</option>
                                    <option value="Cancelada">Cancelada</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>OBSERVAÇÕES</label>
                                <input 
                                    list="obs-list"
                                    className="input-field" 
                                    style={{ minHeight: '45px' }} 
                                    value={formData.observacoes} 
                                    readOnly={!isEditing} 
                                    onChange={e => setFormData({ ...formData, observacoes: e.target.value })} 
                                    placeholder="Selecione uma observação ou digite uma nova..." 
                                />
                                <datalist id="obs-list">
                                    <option value="Período da manhã até as 12h00" />
                                    <option value="Período da tarde após as 13h00" />
                                    <option value="Ligar 1(uma) hora antes para o(a) Doador(a), ir até o local" />
                                    <option value="Ligar 30 minutos antes para o(a) Doador(a), ir até o local" />
                                    <option value="Campainha quebrada" />
                                    <option value="Ligar antes" />
                                    <option value="Aguardar: Doador com dificuldade de locomoção" />
                                    <option value="Retirar na Portaria" />
                                </datalist>
                            </div>
                        </div>
                    </div>

                    <div className="glass-card" style={{ padding: '30px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <div className="section-title-premium" style={{ margin: 0 }}><Package size={16} /> ITENS DA DOAÇÃO</div>
                            {isEditing && (
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button className="btn-action btn-primary" onClick={() => setShowAddItemModal(true)}>
                                        <Plus size={16} /> Adicionar Item
                                    </button>
                                    <button className="btn-action btn-success" onClick={handleSave} disabled={!canEdit}><Save size={18} /> GRAVAR REGISTRO</button>
                                    <button className="btn-action btn-secondary" onClick={() => {
                                        setIsEditing(false);
                                        if (isNew) {
                                            setIsNew(false);
                                            setCurrentIndex(-1);
                                            setFormData({
                                                codigo_doacao: '', codigo_doador: '', doador_nome: '', doadores: {}, data_doacao: '', data_retirada: '',
                                                status: 'Pendente', observacoes: '', itens: [],
                                                remarcado_para: '', responsavel: ''
                                            });
                                        } else {
                                            setIsNew(false);
                                            fetchDonation(currentIndex >= 0 ? currentIndex : 0);
                                        }
                                    }}><X size={18} /> CANCELAR</button>
                                </div>
                            )}
                        </div>
                        <table className="donation-items-table">
                            <thead><tr><th>Descrição</th><th>Categoria</th><th style={{ textAlign: 'center' }}>Qtd</th><th style={{ textAlign: 'center' }}>Un.</th>{isEditing && <th style={{ width: '50px' }}></th>}</tr></thead>
                            <tbody>
                                {formData.itens.length > 0 ? formData.itens.map((it, i) => (
                                    <tr key={i}>
                                        <td style={{ fontWeight: 700 }}>{it.item}</td>
                                        <td>{it.categoria || '---'}</td>
                                        <td style={{ textAlign: 'center', fontWeight: 900 }}>{it.qtde}</td>
                                        <td style={{ textAlign: 'center' }}>{it.unidade || 'UN'}</td>
                                        {isEditing && (
                                            <td>
                                                <button className="btn-action btn-danger" style={{ padding: '4px' }} onClick={() => {
                                                    setFormData({ ...formData, itens: formData.itens.filter((_, idx) => idx !== i) });
                                                }}><Trash2 size={14} /></button>
                                            </td>
                                        )}
                                    </tr>
                                )) : (
                                    <tr><td colSpan={isEditing ? 4 : 3} style={{ textAlign: 'center', padding: '30px', opacity: 0.5 }}>Sem itens listados.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Modais de Ficha */}
            {showAddItemModal && (
                <AddItemModal 
                    categories={categories} 
                    onClose={() => setShowAddItemModal(false)} 
                    onAdd={(newItem) => {
                        setFormData({
                            ...formData,
                            itens: [...formData.itens, newItem]
                        });
                    }}
                />
            )}
            {showQuickPrint && (
                <QuickPrintModal 
                    initialDonationCode={formData.codigo_doacao}
                    userLoggerName={perfil?.nome || user?.email || 'Sistema'}
                    onClose={() => setShowQuickPrint(false)} 
                />
            )}
            {showDonorModal && (
                <SelectDonorModal 
                    onClose={() => setShowDonorModal(false)}
                    onSelect={(donor) => {
                        setFormData({
                            ...formData,
                            codigo_doador: donor.codigo_doador,
                            doador_nome: donor.nome,
                            doadores: donor
                        });
                    }}
                />
            )}
        </div>
    );
};

export default DonationForm;
