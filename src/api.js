import { supabase } from './supabaseClient';
import { toLocalIsoDateTime } from './utils/date';

export const api = {
  // Doadores (Supabase)
  doadores: {
    list: async (params = {}) => {
      let q = supabase.from('doadores').select('*', { count: 'exact' });

      if (params.codigo) q = q.eq('codigo_doador', parseInt(params.codigo, 10));
      if (params.nome) q = q.ilike('nome', `%${params.nome}%`);
      if (params.cep) q = q.eq('cep', params.cep.replace(/\D/g, ''));
      if (params.tel) {
        const clean = params.tel.replace(/\D/g, '');
        q = q.or(`celular.ilike.%${clean}%,whatsapp.ilike.%${clean}%,fixo.ilike.%${clean}%`);
      }
      if (params.tlmk) q = q.eq('cod_tlmk', params.tlmk.trim());
      if (params.matcob) q = q.eq('cod_matcob', params.matcob.trim());

      q = q.order('codigo_doador', { ascending: true });
      const index = parseInt(params.index || 0, 10);
      const limit = parseInt(params.limit || 100, 10);
      q = q.range(index, index + limit - 1);

      const { data, count, error } = await q;
      if (error) throw error;
      return { data: data || [], count: count ?? (data || []).length };
    },
    get: async (codigo) => {
      const { data, error } = await supabase
        .from('doadores')
        .select('*')
        .eq('codigo_doador', parseInt(codigo, 10))
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Doador não encontrado');
      return data;
    },
    getNextCode: async () => {
      const { data, error } = await supabase
        .from('doadores')
        .select('codigo_doador')
        .order('codigo_doador', { ascending: false })
        .limit(1000);
      if (error) throw error;
      let maxVal = 0;
      (data || []).forEach(d => {
        const v = parseInt(d.codigo_doador, 10);
        if (!isNaN(v) && v > maxVal) maxVal = v;
      });
      return { nextCode: String(maxVal + 1).padStart(6, '0') };
    },
    checkDuplicate: async (nome) => {
      const { data, error } = await supabase
        .from('doadores')
        .select('codigo_doador, nome, cep, celular')
        .ilike('nome', `%${nome}%`)
        .limit(10);
      if (error) throw error;
      return data || [];
    },
    create: async (data) => {
      let codigo = parseInt((await api.doadores.getNextCode()).nextCode, 10);
      let attempts = 0;
      while (attempts < 5) {
        attempts++;
        const { data: row, error } = await supabase
          .from('doadores')
          .insert([{ codigo_doador: codigo, ...data, data_cadastro: toLocalIsoDateTime() }])
          .select('codigo_doador')
          .maybeSingle();
        if (!error) {
          return { codigo_doador: String(row.codigo_doador).padStart(6, '0'), insertId: codigo };
        }
        if (error.code !== '23505') throw error;
        codigo += 1;
      }
      throw new Error('Não foi possível gerar um código único.');
    },
    update: async (codigo, data) => {
      const { error } = await supabase
        .from('doadores')
        .update(data)
        .eq('codigo_doador', parseInt(String(codigo).replace(/^0+/, ''), 10));
      if (error) throw error;
      return { success: true };
    },
    getDistinctFields: async () => {
      const { data, error } = await supabase
        .from('doadores')
        .select('mapa, cod_tlmk, cod_matcob')
        .order('codigo_doador', { ascending: false })
        .limit(2000);
      if (error) throw error;
      
      const mapas = [...new Set(data.map(d => d.mapa).filter(v => v && String(v).trim()))].sort();
      const tlmks = [...new Set(data.map(d => d.cod_tlmk).filter(v => v && String(v).trim()))].sort();
      const matcobs = [...new Set(data.map(d => d.cod_matcob).filter(v => v && String(v).trim()))].sort();
      
      return { mapas, tlmks, matcobs };
    },
  },

  // Endereços (Supabase)
  enderecos: {
    getByCep: async (cep) => {
      const clean = cep.replace(/\D/g, '');
      const { data: comMapa, error: err1 } = await supabase
        .from('enderecos_coleta')
        .select('*')
        .eq('cep', clean)
        .not('mapa', 'is', null)
        .not('mapa', 'eq', '')
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (err1) throw err1;
      if (comMapa) return comMapa;
      const { data, error } = await supabase
        .from('enderecos_coleta')
        .select('*')
        .eq('cep', clean)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data || null;
    },
    suggestions: async (params) => {
      let q = supabase.from('enderecos_coleta').select('*');
      if (params.q && params.q.length >= 2) q = q.ilike('endereco', `%${params.q}%`);
      else return [];
      if (params.logradouro && params.logradouro.trim()) q = q.ilike('logradouro', `%${params.logradouro.trim()}%`);
      q = q.order('endereco', { ascending: true }).limit(15);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    checkExists: async (logradouro, endereco) => {
      const { data, error } = await supabase
        .from('enderecos_coleta')
        .select('id')
        .ilike('logradouro', `%${logradouro || ''}%`)
        .ilike('endereco', `%${endereco || ''}%`)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return { exists: !!data, id: data?.id || null };
    },
    create: async (data) => {
      const { data: row, error } = await supabase
        .from('enderecos_coleta')
        .insert({
          logradouro: data.logradouro || '',
          endereco: data.endereco || '',
          cep: data.cep || '',
          bairro: data.bairro || '',
          cidade: data.cidade || '',
          estado: data.estado || '',
          mapa: data.mapa || ''
        })
        .select('id')
        .maybeSingle();
      if (error) throw error;
      return { id: row?.id };
    },
    getMapaByEndereco: async (logradouro, endereco, cep) => {
      // Busca mapa existente para o endereço (prioridade: logradouro+endereco+cep, depois só logradouro+endereco)
      const cleanCep = (cep || '').replace(/\D/g, '');
      const logTrim = (logradouro || '').trim();
      const endTrim = (endereco || '').trim();
      if (!endTrim) return null;
      // Tenta com cep se houver
      if (cleanCep) {
        const { data } = await supabase.from('enderecos_coleta').select('mapa').ilike('logradouro', logTrim || '%').ilike('endereco', endTrim).eq('cep', cleanCep).limit(1).maybeSingle();
        if (data?.mapa) return data.mapa;
      }
      // Fallback sem cep
      const { data } = await supabase.from('enderecos_coleta').select('mapa').ilike('logradouro', logTrim || '%').ilike('endereco', endTrim).not('mapa', 'is', null).neq('mapa', '').limit(1).maybeSingle();
      return data?.mapa || null;
    },
    syncMapa: async (enderecoData) => {
      // Garante que enderecos_coleta contenha o endereço com mapa atualizado
      const cep = (enderecoData.cep || '').replace(/\D/g, '');
      const logradouro = (enderecoData.logradouro || '').trim();
      const endereco = (enderecoData.endereco || '').trim();
      if (!endereco) return null;
      const { data: existing } = await supabase.from('enderecos_coleta').select('id, mapa').ilike('logradouro', logradouro || '%').ilike('endereco', endereco).eq('cep', cep).limit(1).maybeSingle();
      // Se existe mas cep vazio e o novo tem cep, tenta buscar sem cep
      let target = existing;
      if (!target && cep) {
        const { data: alt } = await supabase.from('enderecos_coleta').select('id, mapa').ilike('logradouro', logradouro || '%').ilike('endereco', endereco).limit(1).maybeSingle();
        target = alt;
      }
      if (target) {
        // Atualiza se mapa novo for fornecido ou campos vazios
        const updates = {};
        if (enderecoData.mapa && enderecoData.mapa !== target.mapa) updates.mapa = enderecoData.mapa;
        if (enderecoData.bairro) updates.bairro = enderecoData.bairro;
        if (enderecoData.cidade) updates.cidade = enderecoData.cidade;
        if (enderecoData.estado) updates.estado = enderecoData.estado;
        if (cep) updates.cep = cep;
        if (Object.keys(updates).length > 0) {
          await supabase.from('enderecos_coleta').update(updates).eq('id', target.id);
        }
        return { id: target.id, updated: Object.keys(updates).length > 0 };
      } else {
        // Cria novo
        return await api.enderecos.create(enderecoData);
      }
    },
  },

  // Logs
  logs: {
    list: async () => {
      const { data, error } = await supabase
        .from('logs_sistema')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
    register: async (data) => {
      const { error } = await supabase.from('logs_sistema').insert(data);
      if (error) throw error;
      return { success: true };
    },
  },

  // Notas
  notas: {
    get: async (data, usuario_email) => {
      const email = usuario_email || 'geral';
      const { data: res } = await supabase.from('notas').select('*').eq('data', data).eq('usuario_email', email).maybeSingle();
      return res || null;
    },
    save: async (data, usuario_email, conteudo) => {
      const email = usuario_email || 'geral';
      if (conteudo && conteudo.trim()) {
        const { error } = await supabase.from('notas').upsert({ usuario_email: email, data, conteudo, updated_at: new Date().toISOString() }, { onConflict: 'usuario_email,data' });
        if (error) throw error;
      } else {
        const { error } = await supabase.from('notas').delete().eq('usuario_email', email).eq('data', data);
        if (error) throw error;
      }
      return { success: true };
    },
  },

  // Auth (Supabase Auth + tabela perfis_usuarios)
  auth: {
    login: async (email, password) => {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message || 'Credenciais inválidas');

      const { data: profile } = await supabase
        .from('perfis_usuarios')
        .select('*')
        .eq('email', data.user.email)
        .maybeSingle();

      return {
        user: {
          id: data.user.id,
          email: data.user.email,
          role: profile?.role || 'user',
          departamento: profile?.departamento,
          user_id: profile?.user_id || data.user.id,
        },
        token: data.session.access_token,
      };
    },
    profile: async (email) => {
      const { data } = await supabase
        .from('perfis_usuarios')
        .select('*')
        .eq('email', email)
        .maybeSingle();
      return data || { error: 'Perfil não encontrado' };
    },
  },
};
