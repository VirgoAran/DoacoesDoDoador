import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Save, Edit2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Plus, X, CheckCircle, AlertTriangle, FileText, User, Users, MapPin, Phone, RefreshCcw, Truck, Zap, DollarSign, RotateCcw, Check, Calendar } from 'lucide-react';
import { api } from '../api';
import { registerLog } from '../utils/logger';
import { useAuth } from '../contexts/AuthContext';
import FichaModal from './FichaModal';
import QuickPrintModal from './QuickPrintModal';
import EscalaColeta from './EscalaColeta';

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

const initialFormState = {
    codigo: '', nome: '', celular: '', whatsapp: '', fixo: '', email: '',
    contato: 'O mesmo', cep: '', logradouro: '', endereco: '', complemento: '', bairro: '',
    cidade: '', estado: '', tipo: '', regiao: '', dia_semana: '', mapa: '', cod_tlmk: '', cod_matcob: '', dataCadastro: '', historico: ''
};


const DonorForm = ({ onNavigateToDoacoes, onNavigateToAlterarDoacoes }) => {
    const { user, perfil, isTransportes } = useAuth();
    const canEdit = !isTransportes;

    const [formData, setFormData] = useState(initialFormState);
    const [currentIndex, setCurrentIndex] = useState(-1);
    const [totalRecords, setTotalRecords] = useState(0);
    const [isEditing, setIsEditing] = useState(false);
    const [isNew, setIsNew] = useState(false);
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState(null);
    const [showFichaModal, setShowFichaModal] = useState(false);
    const [showEscalaColeta, setShowEscalaColeta] = useState(false);

    const [duplicateDonors, setDuplicateDonors] = useState([]);
    const [showDuplicateModal, setShowDuplicateModal] = useState(false);

    const [searchCode, setSearchCode] = useState('');
    const [searchName, setSearchName] = useState('');
    const [searchCep, setSearchCep] = useState('');
    const [searchTel, setSearchTel] = useState('');
    const [searchTlmk, setSearchTlmk] = useState('');
    const [searchMatcob, setSearchMatcob] = useState('');
    const [showQuickPrint, setShowQuickPrint] = useState(false);

    const [distinctFields, setDistinctFields] = useState({ mapas: [], tlmks: [], matcobs: [] });

    useEffect(() => {
        api.doadores.getDistinctFields().then(setDistinctFields).catch(console.error);
    }, []);

    // ── Lista Suspensa Inteligente de Endereços ──
    const [addressSuggestions, setAddressSuggestions] = useState([]);
    const [showAddressDropdown, setShowAddressDropdown] = useState(false);
    const [selectedSuggestionIdx, setSelectedSuggestionIdx] = useState(-1);
    const enderecoInputRef = useRef(null);
    const complementoInputRef = useRef(null);
    const addressDropdownRef = useRef(null);
    const searchTimerRef = useRef(null);


    const showToast = useCallback((message, type = 'success') => setToast({ message, type }), []);

    const maskCep = (value) => value.replace(/\D/g, '').replace(/(\d{5})(\d)/, '$1-$2').slice(0, 9);
    const maskPhone = (value) => {
        const n = value.replace(/\D/g, '');
        if (n.length <= 10) {
            return n.replace(/(\d{2})(\d)/, '($1) $2')
                .replace(/(\d{4})(\d)/, '$1-$2');
        }
        // 11‑digit numbers (e.g., mobile with extra digit)
        return n.replace(/(\d{2})(\d)/, '($1) $2')
            .replace(/(\d{5})(\d)/, '$1-$2');
    };

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && showDuplicateModal) {
                setShowDuplicateModal(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [showDuplicateModal]);

    const checkDuplicateName = async (nameToCheck) => {
        if (!nameToCheck || nameToCheck.trim().length < 3) return;
        if (!isNaN(nameToCheck)) return;

        try {
            const data = await api.doadores.checkDuplicate(nameToCheck.trim());

            const filteredData = data.filter(d => String(d.codigo_doador) !== formData.codigo);

            if (filteredData && filteredData.length > 0) {
                setDuplicateDonors(filteredData);
                setShowDuplicateModal(true);
            }
        } catch (e) {
            console.error('Erro ao verificar duplicidade de nome:', e);
        }
    };

    const fetchDonor = useCallback(async (index = 0, filter = null, silent = false) => {
        setLoading(true);
        try {
            const params = { index, limit: 1 };
            if (filter) {
                if (filter.type === 'code' && filter.value) {
                    params.codigo = filter.value.padStart(6, '0').replace(/^0+/, '');
                } else if (filter.type === 'name' && filter.value) {
                    params.nome = filter.value;
                } else if (filter.type === 'cep' && filter.value) {
                    params.cep = filter.value.replace(/\D/g, '');
                } else if (filter.type === 'tel' && filter.value) {
                    params.tel = filter.value;
                } else if (filter.type === 'tlmk' && filter.value) {
                    params.tlmk = filter.value.trim();
                } else if (filter.type === 'matcob' && filter.value) {
                    params.matcob = filter.value.trim();
                }
            }
            let { data, count } = await api.doadores.list(params);
            // Se o offset pedido vier vazio (ex.: registro excluído após a última contagem),
            // recua até encontrar um registro válido (limita a Cód. Doador 000001)
            let idx = index;
            while ((!data || data.length === 0) && idx > 0 && !filter) {
                idx -= 1;
                const retry = await api.doadores.list({ ...params, index: idx });
                data = retry.data;
                count = retry.count;
            }
            if (data?.length > 0) {
                const d = data[0];
                setFormData({
                    codigo: String(d.codigo_doador).padStart(6, '0'), nome: d.nome || '', celular: maskPhone(d.celular || ''),
                    whatsapp: maskPhone(d.whatsapp || ''), fixo: maskPhone(d.fixo || ''), email: d.email || '',
                    contato: d.contato || '',
                    cep: maskCep(d.cep || ''), logradouro: d.logradouro || '', endereco: d.endereco || '',
                    complemento: d.complemento || '', bairro: d.bairro || '', cidade: d.cidade || '',
                    estado: d.estado || '', tipo: d.tipo_doador || '', regiao: d.regiao || '', dia_semana: d.dia_semana || '', mapa: d.mapa || '',
                    cod_tlmk: d.cod_tlmk || '', cod_matcob: d.cod_matcob || '', dataCadastro: d.data_cadastro || '', historico: d.historico || ''
                });
                setCurrentIndex(idx); setTotalRecords(count || 0); setIsEditing(false); setIsNew(false);
            } else {
                if (filter && !silent) showToast('Doador não encontrado.', 'error');
                if (index === 0 && !filter) { setFormData(initialFormState); setCurrentIndex(-1); setTotalRecords(0); }
            }
        } catch (e) {
            console.error('Erro ao buscar doador:', e);
            showToast('Erro de conexão. Tente recarregar.', 'error');
        } finally {
            setLoading(false);
        }
    }, [showToast]);

    useEffect(() => {
        fetchDonor(0);
    }, [fetchDonor]);

    // Persistência de rascunho
    useEffect(() => {
        if (isEditing) {
            localStorage.setItem('donor_draft', JSON.stringify({ formData, isNew, currentIndex }));
        }
    }, [formData, isEditing, isNew, currentIndex]);

    useEffect(() => {
        const draft = localStorage.getItem('donor_draft');
        if (draft && !isEditing) {
            const parsed = JSON.parse(draft);
            if (parsed.formData.codigo) { // Só restaura se tiver algo
                // Opcional: perguntar ao usuário? Por enquanto vamos deixar o estado vivo se o componente não desmontar
            }
        }
    }, [isEditing]);

    const generateNextCode = async () => {
        try {
            const { nextCode } = await api.doadores.getNextCode();
            return nextCode;
        } catch {
            return '000001';
        }
    };

    const handleNew = async () => {
        setLoading(true); const nextCode = await generateNextCode();
        const now = new Date();
        const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        setFormData({ ...initialFormState, codigo: nextCode, contato: 'O mesmo', dataCadastro: localDate });
        setIsNew(true); setIsEditing(true); setLoading(false);
    };

    const handleCepBlur = async () => {
        const cleanCep = formData.cep.replace(/\D/g, '');
        if (cleanCep.length === 8) {
            try {
                const finalAddr = await api.enderecos.getByCep(cleanCep);

                if (finalAddr) {
                    setFormData(prev => ({
                        ...prev,
                        logradouro: finalAddr.logradouro || prev.logradouro,
                        endereco: finalAddr.endereco || prev.endereco,
                        bairro: finalAddr.bairro || prev.bairro,
                        cidade: finalAddr.cidade || prev.cidade,
                        estado: finalAddr.estado || prev.estado,
                        complemento: finalAddr.complemento || prev.complemento,
                        mapa: finalAddr.mapa || prev.mapa
                    }));
                    return;
                }

                // Se não achou na base local, busca no ViaCEP normalmente
                const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
                const data = await res.json();
                if (!data.erro) {
                    const fullLogradouro = data.logradouro || '';
                    const parts = fullLogradouro.split(' ');
                    const detectedTipo = parts[0] || '';
                    const detectedEndereco = parts.slice(1).join(' ') || fullLogradouro;

                    // Tenta buscar mapa existente para esse endereço (ViaCEP + enderecos_coleta)
                    let mapaEncontrado = '';
                    try {
                        mapaEncontrado = await api.enderecos.getMapaByEndereco(detectedTipo, detectedEndereco, cleanCep) || '';
                    } catch {}

                    setFormData(prev => ({
                        ...prev,
                        logradouro: detectedTipo,
                        endereco: detectedEndereco,
                        bairro: data.bairro || '',
                        cidade: data.localidade || '',
                        estado: data.uf || '',
                        mapa: mapaEncontrado || prev.mapa
                    }));
                }
            } catch (e) { console.error(e); }
        }
    };

    // ── Smart Address: Buscar sugestões na tabela enderecos_coleta ──
    const fetchAddressSuggestions = useCallback(async (query) => {
        if (!query || query.length < 2) {
            setAddressSuggestions([]);
            setShowAddressDropdown(false);
            return;
        }
        try {
            const data = await api.enderecos.suggestions({
                q: query,
                logradouro: formData.logradouro
            });
            setAddressSuggestions(data || []);
            setShowAddressDropdown((data || []).length > 0);
            setSelectedSuggestionIdx(-1);
        } catch (e) { console.error(e); }
    }, [formData.logradouro]);

    // Debounce na digitação do endereço
    const handleEnderecoChange = (value) => {
        setFormData(prev => ({ ...prev, endereco: value }));
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        searchTimerRef.current = setTimeout(() => fetchAddressSuggestions(value), 250);
    };

    const handleSelectAddress = (addr) => {
        const enderecoComEspaco = (addr.endereco || '') + ', ';
        setFormData(prev => ({
            ...prev,
            logradouro: addr.logradouro || prev.logradouro,
            endereco: enderecoComEspaco,
            cep: addr.cep ? maskCep(addr.cep) : prev.cep,
            bairro: addr.bairro || prev.bairro,
            cidade: addr.cidade || prev.cidade,
            estado: addr.estado || prev.estado,
            mapa: addr.mapa || prev.mapa
        }));
        setShowAddressDropdown(false);
        setAddressSuggestions([]);
        // Foca no campo Endereço com cursor no final para digitar o número
        setTimeout(() => {
            const input = enderecoInputRef.current;
            if (input) {
                input.focus();
                input.setSelectionRange(enderecoComEspaco.length, enderecoComEspaco.length);
            }
        }, 100);
    };

    // Auto-gravar endereço novo ao sair do campo (TAB/blur)
    const handleEnderecoBlur = async () => {
        setTimeout(async () => {
            setShowAddressDropdown(false);

            const endTrim = (formData.endereco || '').trim();
            const logTrim = (formData.logradouro || '').trim();
            if (!endTrim) return;

            const { exists } = await api.enderecos.checkExists(logTrim, endTrim);

            if (!exists) {
                const newAddr = {
                    logradouro: logTrim,
                    endereco: endTrim,
                    cep: (formData.cep || '').replace(/\D/g, ''),
                    complemento: (formData.complemento || '').trim(),
                    bairro: (formData.bairro || '').trim(),
                    cidade: (formData.cidade || '').trim(),
                    estado: (formData.estado || '').trim(),
                    mapa: (formData.mapa || '').trim()
                };
                await api.enderecos.create(newAddr);
            } else if ((formData.mapa || '').trim()) {
                // Se já existe mas o mapa foi preenchido/alterado, atualiza
                try { await api.enderecos.syncMapa({ logradouro: logTrim, endereco: endTrim, cep: (formData.cep || '').replace(/\D/g, ''), bairro: formData.bairro, cidade: formData.cidade, estado: formData.estado, mapa: formData.mapa }); } catch {}
            }
        }, 200);
    };

    // Navegação por teclado na lista de sugestões
    const handleEnderecoKeyDown = (e) => {
        if (!showAddressDropdown || addressSuggestions.length === 0) {
            if (e.key === 'Tab') handleEnderecoBlur();
            return;
        }
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedSuggestionIdx(prev => Math.min(prev + 1, addressSuggestions.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedSuggestionIdx(prev => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter' && selectedSuggestionIdx >= 0) {
            e.preventDefault();
            handleSelectAddress(addressSuggestions[selectedSuggestionIdx]);
        } else if (e.key === 'Escape') {
            setShowAddressDropdown(false);
        } else if (e.key === 'Tab') {
            if (selectedSuggestionIdx >= 0) {
                handleSelectAddress(addressSuggestions[selectedSuggestionIdx]);
            } else {
                handleEnderecoBlur();
            }
        }
    };

    const handleSave = async (e) => {
        if (e) e.preventDefault();
        setLoading(true);
        try {
            const dbData = {
                nome: formData.nome, celular: formData.celular.replace(/\D/g, ''), whatsapp: formData.whatsapp.replace(/\D/g, ''),
                fixo: formData.fixo.replace(/\D/g, ''), email: formData.email, contato: formData.contato,
                cep: formData.cep.replace(/\D/g, ''),
                logradouro: formData.logradouro, endereco: formData.endereco, complemento: formData.complemento,
                bairro: formData.bairro, cidade: formData.cidade, estado: formData.estado, tipo_doador: formData.tipo,
                regiao: formData.regiao, dia_semana: formData.dia_semana, mapa: formData.mapa, cod_tlmk: formData.cod_tlmk, cod_matcob: formData.cod_matcob, historico: formData.historico
            };
            let savedCode;
            if (isNew) {
                const result = await api.doadores.create(dbData);
                savedCode = result.codigo_doador;
            } else {
                await api.doadores.update(formData.codigo, dbData);
                savedCode = formData.codigo;
            }

            // Sincroniza enderecos_coleta com dados atuais (incluindo Mapa)
            try {
                const enderecoSync = {
                    logradouro: formData.logradouro || '',
                    endereco: formData.endereco || '',
                    cep: formData.cep || '',
                    bairro: formData.bairro || '',
                    cidade: formData.cidade || '',
                    estado: formData.estado || '',
                    mapa: formData.mapa || ''
                };
                if (enderecoSync.endereco.trim() || enderecoSync.cep.replace(/\D/g, '')) {
                    await api.enderecos.syncMapa(enderecoSync);
                }
            } catch (err) {
                console.error('Aviso: falha ao sincronizar enderecos_coleta:', err);
            }

            localStorage.removeItem('donor_draft');
            try {
                await registerLog({
                    usuario_email: user?.email || '',
                    acao: isNew ? 'Inclusão' : 'Alteração',
                    modulo: 'Doadores',
                    detalhes: isNew ? `Novo doador: ${formData.nome} (Cód: ${savedCode})` : `Doador ${formData.codigo} - ${formData.nome} alterado`
                });
            } catch (e) {
                console.error('Erro ao registrar log:', e);
            }

            setIsEditing(false);
            setIsNew(false);
            if (isNew) {
                await fetchDonor(totalRecords, null, true);
            } else {
                await fetchDonor(currentIndex, null, true);
            }
            showToast('Dados salvos com sucesso!');
        } catch (e) { console.error('Erro ao salvar doador:', e); showToast('Erro ao salvar: ' + (e?.message || ''), 'error'); } finally { setLoading(false); }
    };

    const handleSearch = () => {
        if (searchCode) fetchDonor(0, { type: 'code', value: searchCode });
        else if (searchName) fetchDonor(0, { type: 'name', value: searchName });
        else if (searchCep) fetchDonor(0, { type: 'cep', value: searchCep });
        else if (searchTel) fetchDonor(0, { type: 'tel', value: searchTel });
        else if (searchTlmk) fetchDonor(0, { type: 'tlmk', value: searchTlmk });
        else if (searchMatcob) fetchDonor(0, { type: 'matcob', value: searchMatcob });
        else showToast('Preencha ao menos um filtro de busca.', 'info');
    };

    const handleClearSearch = () => {
        setSearchCode('');
        setSearchName('');
        setSearchCep('');
        setSearchTel('');
        setSearchTlmk('');
        setSearchMatcob('');
        fetchDonor(0);
    };

    // Busca a partir dos campos TLMK/MATCOB (prioridade quando preenchidos)
    const handleSidebarSearch = () => {
        if (searchTlmk.trim()) fetchDonor(0, { type: 'tlmk', value: searchTlmk });
        else if (searchMatcob.trim()) fetchDonor(0, { type: 'matcob', value: searchMatcob });
        else handleSearch();
    };

    const sectionTitle = {
        display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', fontWeight: 800,
        color: 'var(--primary-color)', textTransform: 'uppercase', letterSpacing: '0.02em',
        borderBottom: '2px solid var(--primary-soft)', paddingBottom: '8px', marginBottom: '16px', marginTop: '8px'
    };

    const fieldLabel = { display: 'block', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase' };

    const grid12 = { display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '14px', marginBottom: '18px' };

    return (
        <div className="main-content-layout" style={{ flexDirection: 'column', gap: '16px' }}>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            {/* ── Busca ── */}
            <div className="glass-card" style={{ margin: 0, padding: '20px', border: '1px solid var(--border-color)', width: '100%' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '110px minmax(160px, 1.5fr) 130px 170px auto auto', gap: '14px', alignItems: 'flex-end', overflowX: 'auto' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label style={fieldLabel}>Cód. Doador:</label>
                        <div style={{ position: 'relative' }}><Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} /><input className="input-field" style={{ paddingLeft: '38px', width: '100%' }} placeholder="Ex: 123" value={searchCode} onChange={e => setSearchCode(e.target.value.replace(/\D/g, ''))} onKeyDown={e => e.key === 'Enter' && handleSearch()} /></div>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label style={fieldLabel}>Nome:</label>
                        <div style={{ position: 'relative' }}><Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} /><input className="input-field" style={{ paddingLeft: '38px', width: '100%' }} placeholder="Nome do doador" value={searchName} onChange={e => setSearchName(e.target.value)} onBlur={() => checkDuplicateName(searchName)} onKeyDown={e => { if (e.key === 'Enter') handleSearch(); else if (e.key === 'Tab') checkDuplicateName(searchName); }} /></div>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label style={fieldLabel}>CEP:</label>
                        <div style={{ position: 'relative' }}><MapPin size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} /><input className="input-field" style={{ paddingLeft: '38px', width: '100%' }} placeholder="00000-000" value={searchCep} onChange={e => setSearchCep(maskCep(e.target.value))} onKeyDown={e => e.key === 'Enter' && handleSearch()} /></div>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label style={fieldLabel}>Telefone:</label>
                        <div style={{ position: 'relative' }}><Phone size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} /><input className="input-field" style={{ paddingLeft: '38px', width: '100%' }} placeholder="(00) 00000-0000" value={searchTel} onChange={e => setSearchTel(maskPhone(e.target.value))} onKeyDown={e => e.key === 'Enter' && handleSearch()} /></div>
                    </div>
                    <button className="btn-action btn-primary" style={{ height: '45px' }} onClick={handleSearch}><Search size={18} /> Filtrar</button>
                    <button className="btn-action btn-secondary" style={{ height: '45px', background: 'var(--card-bg)', border: '1px solid var(--border-color)' }} onClick={handleClearSearch}><RotateCcw size={18} /> Limpar</button>
                </div>
            </div>

            {/* ── Barra de Ações ── */}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '10px', width: '100%' }}>
                <div className="nav-bar" style={{ margin: 0, gap: '6px', padding: '6px 12px', borderRadius: '8px', boxShadow: 'var(--shadow-sm)' }}>
                    <button className="btn-nav" onClick={() => fetchDonor(0)} disabled={currentIndex <= 0 || loading || isEditing} title="Primeiro Registro"><ChevronsLeft size={18} /></button>
                    <button className="btn-nav" onClick={() => fetchDonor(currentIndex - 1)} disabled={currentIndex <= 0 || loading || isEditing} title="Registro Anterior"><ChevronLeft size={18} /></button>
                    <span className="nav-counter" style={{ fontSize: '0.85rem' }}>{totalRecords === 0 ? '0 / 0' : `${currentIndex + 1} / ${totalRecords}`}</span>
                    <button className="btn-nav" onClick={() => fetchDonor(currentIndex + 1)} disabled={currentIndex >= totalRecords - 1 || loading || isEditing} title="Próximo Registro"><ChevronRight size={18} /></button>
                    <button className="btn-nav" onClick={() => fetchDonor(totalRecords - 1)} disabled={currentIndex >= totalRecords - 1 || loading || isEditing} title="Último Registro"><ChevronsRight size={18} /></button>
                </div>

                <button className="btn-nav" style={{ background: 'var(--primary-pastel-blue)', color: 'white', borderColor: 'var(--primary-pastel-blue)', boxShadow: '0 4px 10px rgba(74, 144, 226, 0.3)' }} onClick={() => setShowQuickPrint(true)} title="Impressão Rápida"><Zap size={18} fill="currentColor" /></button>

                <button className="btn-action btn-success" style={{ height: '38px' }} onClick={handleNew} disabled={!canEdit}><Plus size={18} /> Novo</button>

                <button className="btn-action btn-success" style={{ height: '38px', opacity: (!isEditing || !canEdit) ? 0.6 : 1, cursor: (!isEditing || !canEdit) ? 'not-allowed' : 'pointer' }} disabled={!isEditing || !canEdit} onClick={handleSave} title="Gravar as alterações feitas"><Save size={18} /> Gravar</button>

                <button className="btn-action btn-primary" style={{ height: '38px' }} onClick={() => setIsEditing(true)} disabled={totalRecords === 0 || !canEdit}><Edit2 size={18} /> Alterar</button>

                <button type="button" className="btn-action btn-secondary" style={{ height: '38px' }} onClick={() => { setIsEditing(false); setIsNew(false); fetchDonor(currentIndex >= 0 ? currentIndex : 0); }} disabled={!isEditing} title="Cancelar o cadastramento ou alteração"><X size={18} /> Cancelar</button>

                <button className="btn-action btn-secondary" style={{ height: '38px' }} onClick={() => { fetchDonor(currentIndex); showToast('Dados sincronizados do banco!', 'info'); }}><RefreshCcw size={18} className={loading ? 'animate-spin' : ''} /> Sincronizar</button>

                <button className="btn-action btn-secondary" style={{ height: '38px' }} onClick={() => { setFormData(initialFormState); setIsNew(false); setIsEditing(false); }}>Limpar</button>
            </div>

            {/* ── Corpo: Formulário + Sidebar ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 260px', gap: '20px', alignItems: 'start', width: '100%' }}>

                <form className="glass-card" style={{ margin: 0, padding: '24px', border: '1px solid var(--border-color)', width: '100%' }} onSubmit={handleSave}>
                    {/* Identificação Principal */}
                    <h3 style={sectionTitle}><User size={18} /> Identificação Principal</h3>
                    <div style={grid12}>
                        <div className="form-group" style={{ gridColumn: 'span 6', marginBottom: 0 }}>
                            <label style={fieldLabel}>Nome Completo</label>
                            <input className="input-field" value={formData.nome || ''} readOnly={!isEditing} onChange={e => setFormData({ ...formData, nome: e.target.value })} onBlur={() => { if (isEditing) checkDuplicateName(formData.nome); }} onKeyDown={e => { if (isEditing && (e.key === 'Enter' || e.key === 'Tab')) checkDuplicateName(formData.nome); }} placeholder="Nome completo do doador" required />
                        </div>
                        <div className="form-group" style={{ gridColumn: 'span 3', marginBottom: 0 }}>
                            <label style={fieldLabel}>Cód. Doador</label>
                            <input className="input-field input-readonly" value={formData.codigo} readOnly style={{ textAlign: 'center', fontWeight: 900 }} />
                        </div>
                        <div className="form-group" style={{ gridColumn: 'span 3', marginBottom: 0 }}>
                            <label style={fieldLabel}>Cadastro</label>
                            <input className="input-field input-readonly" value={formData.dataCadastro ? formData.dataCadastro.split(/[-T /]/).slice(0, 3).reverse().join('/') : ''} readOnly style={{ textAlign: 'center' }} />
                        </div>
                    </div>

                    {/* Meios de Contato */}
                    <h3 style={sectionTitle}><Phone size={18} /> Meios de Contato</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: '14px', marginBottom: '18px' }}>
                        <div className="form-group" style={{ gridColumn: 'span 2', marginBottom: 0 }}><label style={fieldLabel}>Celular</label><input className="input-field" value={formData.celular} readOnly={!isEditing} onChange={e => setFormData({ ...formData, celular: maskPhone(e.target.value) })} placeholder="(00) 00000-0000" /></div>
                        <div className="form-group" style={{ gridColumn: 'span 2', marginBottom: 0 }}><label style={fieldLabel}>Fixo</label><input className="input-field" value={formData.fixo} readOnly={!isEditing} onChange={e => setFormData({ ...formData, fixo: maskPhone(e.target.value) })} placeholder="(00) 0000-0000" /></div>
                        <div className="form-group" style={{ gridColumn: 'span 2', marginBottom: 0 }}><label style={fieldLabel}>Contato</label><input className="input-field" value={formData.contato} readOnly={!isEditing} onChange={e => setFormData({ ...formData, contato: e.target.value })} placeholder="Ref..." /></div>
                        <div className="form-group" style={{ gridColumn: 'span 2', marginBottom: 0 }}><label style={fieldLabel}>Email</label><input className="input-field" value={formData.email} readOnly={!isEditing} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="exemplo@email.com" /></div>
                        <div className="form-group" style={{ gridColumn: 'span 2', marginBottom: 0 }}><label style={fieldLabel}>WhatsApp</label><input className="input-field" value={formData.whatsapp} readOnly={!isEditing} onChange={e => setFormData({ ...formData, whatsapp: maskPhone(e.target.value) })} placeholder="(00) 00000-0000" /></div>
                    </div>

                    {/* Endereço de Coleta */}
                    <h3 style={sectionTitle}><MapPin size={18} /> Endereço de Coleta</h3>
                    <div style={grid12}>
                        <div className="form-group" style={{ gridColumn: 'span 2', marginBottom: 0 }}>
                            <label style={fieldLabel}>CEP</label>
                            <input className="input-field" style={{ width: '100%' }} value={formData.cep} readOnly={!isEditing} onChange={e => setFormData({ ...formData, cep: maskCep(e.target.value) })} onBlur={handleCepBlur} placeholder="00000-000" />
                        </div>
                        <div className="form-group" style={{ gridColumn: 'span 3', marginBottom: 0 }}>
                            <label style={fieldLabel}>Logradouro</label>
                            <input className="input-field" style={{ width: '100%' }} value={formData.logradouro} readOnly={!isEditing} onChange={e => setFormData({ ...formData, logradouro: e.target.value })} placeholder="Rua, Av..." list="logradouros-list" />
                            <datalist id="logradouros-list">
                                <option value="Rua" /><option value="Avenida" /><option value="Alameda" /><option value="Estrada" /><option value="Rodovia" /><option value="Praça" /><option value="Beco" /><option value="Travessa" /><option value="Viela" /><option value="Lote" /><option value="Chácara" /><option value="Condomínio" /><option value="Residencial" /><option value="Sítio" />
                            </datalist>
                        </div>
                        <div className="form-group" style={{ gridColumn: 'span 7', marginBottom: 0, position: 'relative' }}>
                            <label style={fieldLabel}>Endereço <span style={{ fontSize: '0.6rem', opacity: 0.6, fontWeight: 400 }}>(digite para buscar)</span></label>
                            <input
                                ref={enderecoInputRef}
                                className="input-field"
                                style={{ width: '100%' }}
                                value={formData.endereco}
                                readOnly={!isEditing}
                                onChange={e => handleEnderecoChange(e.target.value)}
                                onKeyDown={handleEnderecoKeyDown}
                                onBlur={handleEnderecoBlur}
                                onFocus={() => { if (formData.endereco && formData.endereco.length >= 2 && isEditing) fetchAddressSuggestions(formData.endereco); }}
                                placeholder="Nome da rua/avenida..."
                                autoComplete="off"
                            />
                            {showAddressDropdown && isEditing && addressSuggestions.length > 0 && (
                                <div
                                    ref={addressDropdownRef}
                                    style={{
                                        position: 'absolute', top: '100%', left: 0, right: 0,
                                        background: 'var(--card-bg)', border: '2px solid var(--primary-color)',
                                        borderRadius: '0 0 0 0', boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                                        zIndex: 9999, maxHeight: '280px', overflowY: 'auto', marginTop: '-2px'
                                    }}
                                >
                                    {addressSuggestions.map((addr, idx) => (
                                        <div
                                            key={addr.id}
                                            onMouseDown={(e) => { e.preventDefault(); handleSelectAddress(addr); }}
                                            style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border-color)', background: idx === selectedSuggestionIdx ? 'var(--primary-soft)' : 'transparent', transition: 'background 0.15s' }}
                                            onMouseEnter={() => setSelectedSuggestionIdx(idx)}
                                        >
                                            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-color)' }}>
                                                {addr.logradouro} {addr.endereco}
                                            </div>
                                            <div style={{ fontSize: '0.75rem', opacity: 0.6, display: 'flex', gap: '12px', marginTop: '2px' }}>
                                                <span>{addr.bairro}</span>
                                                <span>{addr.cidade}/{addr.estado}</span>
                                                {addr.cep && <span>CEP: {maskCep(addr.cep)}</span>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div style={grid12}>
                        <div className="form-group" style={{ gridColumn: 'span 3', marginBottom: 0 }}><label style={fieldLabel}>Bairro</label><input className="input-field" value={formData.bairro} readOnly={!isEditing} onChange={e => setFormData({ ...formData, bairro: e.target.value })} placeholder="Bairro" /></div>
                        <div className="form-group" style={{ gridColumn: 'span 4', marginBottom: 0 }}><label style={fieldLabel}>Complemento</label><input ref={complementoInputRef} className="input-field" value={formData.complemento} readOnly={!isEditing} onChange={e => setFormData({ ...formData, complemento: e.target.value })} placeholder="Bl, Apto..." /></div>
                        <div className="form-group" style={{ gridColumn: 'span 5', marginBottom: 0 }}><label style={fieldLabel}>Cidade</label><input className="input-field" value={formData.cidade} readOnly={!isEditing} onChange={e => setFormData({ ...formData, cidade: e.target.value })} placeholder="Cidade" /></div>
                    </div>

                    <div style={grid12}>
                        <div className="form-group" style={{ gridColumn: 'span 1', marginBottom: 0 }}><label style={fieldLabel}>UF</label><input className="input-field" value={formData.estado} readOnly={!isEditing} onChange={e => setFormData({ ...formData, estado: e.target.value })} maxLength={50} style={{ textAlign: 'center' }} /></div>
                        <div className="form-group" style={{ gridColumn: 'span 1', marginBottom: 0 }}>
                            <label style={{ ...fieldLabel, color: 'var(--primary-color)' }}>Mapa</label>
                            <input list="mapa-list" className="input-field" style={{ fontWeight: 800, color: 'var(--primary-color)', textAlign: 'center' }} value={formData.mapa || ''} readOnly={!isEditing} onChange={e => setFormData({ ...formData, mapa: e.target.value })} placeholder="Mapa" />
                            <datalist id="mapa-list">
                                {distinctFields.mapas.map(m => <option key={m} value={m} />)}
                            </datalist>
                        </div>
                        <div className="form-group" style={{ gridColumn: 'span 3', marginBottom: 0 }}>
                            <label style={fieldLabel}>Tipo de Doador</label>
                            <input list="tipo-doador-list" className="input-field" value={formData.tipo} readOnly={!isEditing} onChange={e => setFormData({ ...formData, tipo: e.target.value })} placeholder="Selecione ou digite..." />
                            <datalist id="tipo-doador-list">
                                <option value="Comum" /><option value="Boleto Bancário" /><option value="Contribuinte" /><option value="Telemarketing" /><option value="Voluntário(a)" /><option value="Parente de Diretor(a)" /><option value="Parente de Contribuinte" /><option value="Parente de Funcionário(a)" /><option value="Mensal" /><option value="Semanal" /><option value="Quinzenal" /><option value="Semestral" /><option value="Frequentador(a) do Centro" />
                            </datalist>
                        </div>
                        <div className="form-group" style={{ gridColumn: 'span 7', marginBottom: 0 }}>
                            <label style={fieldLabel}>Região</label>
                            <input list="regiao-list" className="input-field" value={formData.regiao} readOnly={!isEditing} onChange={e => setFormData({ ...formData, regiao: e.target.value })} placeholder="Selecione ou digite..." />
                            <datalist id="regiao-list">
                                <option value="Guarulhos" /><option value="Itaquera" /><option value="Penha" /><option value="Ponte Grande" /><option value="Sapopemba" /><option value="Tatuapé" /><option value="Zona Norte" /><option value="Zona Oeste" /><option value="Zona Leste" /><option value="Zona Sul" />
                            </datalist>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', gap: '14px' }}>
                        <div className="form-group" style={{ gridColumn: 'span 2', marginBottom: 0 }}>
                            <label style={fieldLabel}>TLMK</label>
                            <input list="tlmk-list" className="input-field" style={{ textAlign: 'center', fontWeight: 600, minWidth: 0 }} value={formData.cod_tlmk} readOnly={!isEditing} onChange={e => setFormData({ ...formData, cod_tlmk: e.target.value })} />
                            <datalist id="tlmk-list">
                                {distinctFields.tlmks.map(t => <option key={t} value={t} />)}
                            </datalist>
                        </div>
                        <div className="form-group" style={{ gridColumn: 'span 2', marginBottom: 0 }}>
                            <label style={fieldLabel}>MATCOB</label>
                            <input list="matcob-list" className="input-field" style={{ textAlign: 'center', fontWeight: 600, minWidth: 0 }} value={formData.cod_matcob} readOnly={!isEditing} onChange={e => setFormData({ ...formData, cod_matcob: e.target.value })} />
                            <datalist id="matcob-list">
                                {distinctFields.matcobs.map(m => <option key={m} value={m} />)}
                            </datalist>
                        </div>
                        <div className="form-group" style={{ gridColumn: 'span 2', marginBottom: 0, marginLeft: '8px', minWidth: 0 }}>
                            <label style={fieldLabel}>Dia da Semana</label>
                            <select className="input-field" style={{ width: '100%', minWidth: 0 }} value={formData.dia_semana} disabled={!isEditing} onChange={e => setFormData({ ...formData, dia_semana: e.target.value })}>
                                <option value="">Selecione...</option>
                                <option value="Segunda">Segunda</option><option value="Terça">Terça</option><option value="Quarta">Quarta</option><option value="Quinta">Quinta</option><option value="Sexta">Sexta</option><option value="Sábado">Sábado</option><option value="Domingo">Domingo</option><option value="Seg/Ter/Sex">Seg/Ter/Sex</option>
                            </select>
                        </div>
                        <div className="form-group" style={{ gridColumn: 'span 6', marginBottom: 0, marginLeft: '8px' }}><label style={fieldLabel}>Histórico</label><input className="input-field" value={formData.historico || ''} readOnly={!isEditing} onChange={e => setFormData({ ...formData, historico: e.target.value })} placeholder="Observações, referências, instruções de entrega..." /></div>
                    </div>
                </form>

                {/* ── Sidebar ── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div className="glass-card" style={{ margin: 0, padding: '16px', border: '1px solid var(--border-color)' }}>
                        <h4 style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '12px', textAlign: 'center', letterSpacing: '0.02em' }}>Ações Rápidas</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <button className="btn-action btn-primary" style={{ width: '100%', height: '38px', backgroundColor: 'var(--primary-pastel-blue)' }} onClick={() => setShowEscalaColeta(true)} disabled={isTransportes} title={isTransportes ? 'Acesso não permitido' : 'Escala de Coleta'}><Calendar size={16} /> Escala de Coleta</button>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label style={fieldLabel}>TLMK</label>
                                <input className="input-field" style={{ width: '100%', textAlign: 'center', fontWeight: 600 }} placeholder="Buscar por TLMK" value={searchTlmk} onChange={e => { setSearchTlmk(e.target.value); setSearchMatcob(''); }} onKeyDown={e => e.key === 'Enter' && handleSidebarSearch()} />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label style={fieldLabel}>MATCOB</label>
                                <input className="input-field" style={{ width: '100%', textAlign: 'center', fontWeight: 600 }} placeholder="Buscar por MATCOB" value={searchMatcob} onChange={e => { setSearchMatcob(e.target.value); setSearchTlmk(''); }} onKeyDown={e => e.key === 'Enter' && handleSidebarSearch()} />
                            </div>
                            <button className="btn-action btn-primary" style={{ width: '100%', height: '38px' }} onClick={handleSidebarSearch}><Search size={16} /> Buscar</button>
                            <button className="btn-action btn-primary" style={{ width: '100%', height: '38px', backgroundColor: '#f59e0b' }} onClick={() => onNavigateToAlterarDoacoes?.(formData)} disabled={totalRecords === 0 || isTransportes} title="Alterar doações deste doador"><Edit2 size={16} /> Alterar Doações</button>
                            <button className="btn-action btn-primary" style={{ width: '100%', height: '38px', backgroundColor: 'var(--accent-color)' }} onClick={() => onNavigateToDoacoes(formData)} disabled={totalRecords === 0 || isTransportes} title="Registrar doação para este doador"><Truck size={16} /> Doações</button>
                            <button className="btn-action btn-secondary" style={{ width: '100%', height: '38px' }} onClick={() => setShowFichaModal(true)} disabled={totalRecords === 0} title="Imprimir Ficha do Doador"><FileText size={16} /> Ficha Doador</button>
                        </div>
                    </div>

                    <div className="glass-card" style={{ margin: 0, padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', border: '1px solid var(--border-color)' }}>
                        <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--success-color)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={32} strokeWidth={3} /></div>
                        <span style={{ fontWeight: 700, color: 'var(--text-color)' }}>Doador Ativo</span>
                    </div>
                </div>
            </div>

            {/* Duplicate Alert Modal */}
            {showDuplicateModal && (
                <div className="modal-overlay" style={{ zIndex: 10000, position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowDuplicateModal(false)}>
                    <div className="modal-content" style={{ background: 'var(--card-bg, #1a1b1e)', width: '90%', maxWidth: '600px', borderRadius: '0', border: '3px solid #ef4444', padding: '20px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header" style={{ marginBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, color: '#ef4444', display: 'flex', alignItems: 'center', gap: '10px' }}><AlertTriangle /> Atenção: Nome(s) já cadastrado(s)</h3>
                            <button className="btn-close" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-color)' }} onClick={() => setShowDuplicateModal(false)}><X size={24} /></button>
                        </div>
                        <div className="modal-body" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                            <p style={{ marginBottom: '15px', fontSize: '0.95rem' }}>Os seguintes doadores foram encontrados com um nome semelhante. Verifique se não é a mesma pessoa antes de prosseguir:</p>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left' }}>
                                        <th style={{ padding: '8px' }}>CÓDIGO</th>
                                        <th style={{ padding: '8px' }}>Nome</th>
                                        <th style={{ padding: '8px' }}>CEP</th>
                                        <th style={{ padding: '8px' }}>Celular</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {duplicateDonors.map((d, i) => (
                                        <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                            <td style={{ padding: '8px', fontWeight: 'bold' }}>{d.codigo_doador}</td>
                                            <td style={{ padding: '8px' }}>{d.nome}</td>
                                            <td style={{ padding: '8px' }}>{d.cep ? maskCep(d.cep) : ''}</td>
                                            <td style={{ padding: '8px' }}>{d.celular ? maskPhone(d.celular) : ''}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            <FichaModal isOpen={showFichaModal} doador={formData} onClose={() => setShowFichaModal(false)} />
            <EscalaColeta isOpen={showEscalaColeta} onClose={() => setShowEscalaColeta(false)} />

            {showQuickPrint && (
                <QuickPrintModal
                    initialDonorCode={formData.codigo}
                    userLoggerName={perfil?.nome || user?.email || 'Sistema'}
                    onClose={() => setShowQuickPrint(false)}
                />
            )}
        </div>
    );
};

export default DonorForm;
