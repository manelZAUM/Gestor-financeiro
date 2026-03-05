// Inicialização de dados vindos do LocalStorage
let transacoes = JSON.parse(localStorage.getItem('financas_data')) || [];
let produtos = JSON.parse(localStorage.getItem('meus_produtos')) || [];
let historicoCapital = JSON.parse(localStorage.getItem('capital_historico')) || [];
let meuGrafico = null;

/**
 * GESTÃO DE CAPITAL DE GIRO (BLOQUEIO DE SALDO NEGATIVO)
 */
document.getElementById('form-capital')?.addEventListener('submit', function(e) {
    e.preventDefault();
    lancarMovimentoCapital(1); // 1 = Adicionar à reserva
});

function lancarRetiradaCapital() { 
    lancarMovimentoCapital(-1); // -1 = Retirar da reserva
}

function lancarMovimentoCapital(multiplicador) {
    const desc = document.getElementById('cap-desc').value;
    const valorRaw = parseFloat(document.getElementById('valor-reserva').value);
    const dataRaw = document.getElementById('cap-data').value;
    const elSaldoDisp = document.getElementById('saldo-disponivel');
    const elReservaVisual = document.getElementById('total-capital-reserva');

    if(!desc || isNaN(valorRaw) || !dataRaw) return alert("Preencha todos os campos.");

    const entradasTotal = transacoes.filter(t => ['Serviço','Produto'].includes(t.cat)).reduce((a,b) => a + b.valor, 0);
    const saidasTotal = transacoes.filter(t => !['Serviço','Produto'].includes(t.cat)).reduce((a,b) => a + b.valor, 0);
    const saldoLiquidoAtual = entradasTotal - saidasTotal;
    const saldoAtualReserva = historicoCapital.reduce((acc, item) => acc + item.valor, 0);
    const saldoDisponivelReal = saldoLiquidoAtual - saldoAtualReserva;

    if (multiplicador === -1 && valorRaw > saldoAtualReserva) {
        if(elReservaVisual) elReservaVisual.style.color = "var(--danger)";
        alert(`Operação negada! Sua reserva possui apenas R$ ${saldoAtualReserva.toFixed(2)}.`);
        return;
    }

    if (multiplicador === 1 && valorRaw > saldoDisponivelReal) {
        if(elSaldoDisp) elSaldoDisp.style.color = "var(--danger)";
        alert(`Operação negada! Seu saldo disponível (R$ ${saldoDisponivelReal.toFixed(2)}) é insuficiente.`);
        return;
    }

    historicoCapital.push({ 
        id: Date.now(), 
        data: dataRaw.split('-').reverse().join('/'), 
        desc: desc, 
        valor: valorRaw * multiplicador 
    });
    
    atualizarTudo();
    document.getElementById('form-capital').reset();
}

/**
 * GESTÃO DE ESTOQUE E CADASTRO
 */
document.getElementById('form-cadastro-prod')?.addEventListener('submit', function(e) {
    e.preventDefault();
    produtos.push({
        id: 'p' + Date.now(),
        nome: document.getElementById('c-prod-nome').value,
        qtd: parseInt(document.getElementById('c-prod-qtd').value),
        custo: parseFloat(document.getElementById('c-prod-custo').value),
        venda: parseFloat(document.getElementById('c-prod-venda').value)
    });
    atualizarTudo();
    this.reset();
});

function reporEstoque(index) {
    const inputQtd = document.getElementById(`add-qtd-${index}`);
    const qtd = parseInt(inputQtd.value);
    if (qtd && qtd > 0) { 
        produtos[index].qtd += qtd; 
        atualizarTudo(); 
    } else { 
        alert("Digite uma quantidade válida para repor."); 
    }
}

/**
 * LANÇAMENTOS (SERVIÇOS, VENDAS E SAÍDAS)
 */
document.getElementById('form-servico')?.addEventListener('submit', function(e) { 
    e.preventDefault(); 
    lancar('Serviço', document.getElementById('serv-desc').value, document.getElementById('serv-valor').value, document.getElementById('serv-data').value); 
    this.reset(); 
});

document.getElementById('form-produto-venda')?.addEventListener('submit', function(e) {
    e.preventDefault();
    const p = produtos.find(x => x.id === document.getElementById('sel-venda-prod').value);
    if(p && p.qtd > 0) { 
        p.qtd -= 1; 
        lancar('Produto', p.nome, p.venda, document.getElementById('prod-data').value); 
        this.reset(); 
    } else { 
        alert("Sem estoque disponível para este produto!"); 
    }
});

document.getElementById('form-saida-geral')?.addEventListener('submit', function(e) {
    e.preventDefault();
    lancar('Saída', document.getElementById('sai-desc').value, document.getElementById('sai-valor').value, document.getElementById('sai-data').value);
    this.reset();
});

function lancar(cat, desc, valor, data) {
    if(!data) return alert("Selecione uma data.");
    transacoes.push({ 
        id: Date.now(), 
        data: data.split('-').reverse().join('/'), 
        desc: desc, 
        valor: parseFloat(valor), 
        cat: cat 
    });
    atualizarTudo();
}

/**
 * FUNÇÕES DE RENDERIZAÇÃO E ATUALIZAÇÃO
 */
function atualizarTudo() {
    // 1º Salva no LocalStorage
    localStorage.setItem('financas_data', JSON.stringify(transacoes));
    localStorage.setItem('meus_produtos', JSON.stringify(produtos));
    localStorage.setItem('capital_historico', JSON.stringify(historicoCapital));
    
    // 2º Atualiza os anos nos selects primeiro (evita o erro "Indefinido")
    atualizarAnosFiltro(); 
    
    // 3º Renderiza as telas
    renderizarDashboard(); 
    renderizarTabelas(); 
    renderizarMensal(); 
    renderizarDiario(); 
    renderizarGrafico(); 
    verificarStatusBackup();
}

function atualizarAnosFiltro() {
    // Extrai os anos, ignora valores vazios/indefinidos e remove duplicatas
    let anos = [...new Set(transacoes
        .map(t => t.data ? t.data.split('/')[2] : null)
        .filter(a => a !== undefined && a !== null && a !== '')
    )].sort().reverse();
    
    // Se não houver anos registrados ainda, coloca o ano atual como padrão
    if(anos.length === 0) {
        anos.push(new Date().getFullYear().toString());
    }

    ['filtro-ano-mensal', 'filtro-ano-diario'].forEach(id => { 
        const select = document.getElementById(id); 
        if(select) {
            const valorAtual = select.value; // Guarda o que estava selecionado
            select.innerHTML = anos.map(a => `<option value="${a}">${a}</option>`).join(''); 
            
            // Mantém a seleção do usuário se o ano ainda existir na lista
            if (valorAtual && anos.includes(valorAtual)) {
                select.value = valorAtual;
            }
        }
    });
}

function renderizarDashboard() {
    if (!document.getElementById('total-entradas')) return; 

    const entradas = transacoes.filter(t => ['Serviço','Produto'].includes(t.cat));
    const ent = entradas.reduce((a,b) => a + b.valor, 0);
    const sai = transacoes.filter(t => !['Serviço','Produto'].includes(t.cat)).reduce((a,b) => a + b.valor, 0);
    const totalReservado = historicoCapital.reduce((a,b) => a + b.valor, 0);
    const saldoLiquido = ent - sai;
    const saldoDisponivel = saldoLiquido - totalReservado;

    document.getElementById('total-entradas').innerText = `R$ ${ent.toFixed(2)}`;
    document.getElementById('total-saidas').innerText = `R$ ${sai.toFixed(2)}`;
    
    if(document.getElementById('total-capital-reserva')) {
        document.getElementById('total-capital-reserva').innerText = `R$ ${totalReservado.toFixed(2)}`;
    }
    
    const elDisp = document.getElementById('saldo-disponivel');
    if(elDisp) { 
        elDisp.innerText = `R$ ${saldoDisponivel.toFixed(2)}`; 
        elDisp.className = `valor ${saldoDisponivel >= 0 ? 'positivo' : 'negativo'}`; 
    }
    
    if(document.getElementById('saldo-liquido-full')) {
        document.getElementById('saldo-liquido-full').innerText = `R$ ${saldoLiquido.toFixed(2)}`;
    }

    // Ticket Médio
    if (document.getElementById('ticket-medio')) {
        document.getElementById('ticket-medio').innerText = `R$ ${(entradas.length > 0 ? ent / entradas.length : 0).toFixed(2)}`;
    }

    // Produtos Mais Vendidos
    const elMaisVendidos = document.getElementById('lista-mais-vendidos');
    if (elMaisVendidos) {
        const contagem = {};
        transacoes.filter(t => t.cat === 'Produto').forEach(t => { 
            contagem[t.desc] = (contagem[t.desc] || 0) + 1; 
        });
        
        const top = Object.entries(contagem).sort((a, b) => b[1] - a[1]).slice(0, 3);
        
        elMaisVendidos.innerHTML = top.map(p => `
            <li style="display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #333;">
                <span>${p[0]}</span> 
                <span class="positivo">${p[1]} un</span>
            </li>
        `).join('') || '<li style="color: #888; font-size: 0.9rem;">Nenhuma venda.</li>';
    }
}

function renderizarTabelas() {
    // Lançamentos agrupados por data
    const tbodyLancamentos = document.getElementById('tabela-corpo');
    if (tbodyLancamentos) {
        const agrupado = {};
        transacoes.forEach((t, i) => { 
            if (!agrupado[t.data]) agrupado[t.data] = []; 
            agrupado[t.data].push({ ...t, idx: i }); 
        });
        
        const datas = Object.keys(agrupado).sort((a, b) => new Date(b.split('/').reverse().join('-')) - new Date(a.split('/').reverse().join('-')));
        
        let html = '';
        datas.forEach(d => {
            html += `<tr style="background-color: #222;"><td colspan="5" style="text-align: center; font-weight: bold; color: var(--primary); padding: 8px;">📅 ${d}</td></tr>`;
            agrupado[d].forEach(t => { 
                html += `<tr>
                    <td>${t.data}</td>
                    <td>${t.desc}</td>
                    <td>${t.cat}</td>
                    <td class="${['Serviço', 'Produto'].includes(t.cat) ? 'positivo' : 'negativo'}">R$ ${t.valor.toFixed(2)}</td>
                    <td><button onclick="excluir('trans', ${t.idx})" style="color:red; background:none; border:none; font-weight:bold; cursor:pointer;">X</button></td>
                </tr>`; 
            });
        });
        tbodyLancamentos.innerHTML = html;
    }

    // Capital de Giro
    const tbodyCapital = document.getElementById('tabela-capital-corpo');
    if (tbodyCapital) {
        tbodyCapital.innerHTML = historicoCapital.map((c, i) => `<tr><td>${c.data}</td><td>${c.desc}</td><td class="${c.valor >= 0 ? 'positivo' : 'negativo'}">R$ ${c.valor.toFixed(2)}</td><td><button onclick="excluir('capital', ${i})" style="color:red; background:none; border:none; cursor:pointer; font-weight:bold;">X</button></td></tr>`).join('');
    }

    // Select de Vendas
    const selVenda = document.getElementById('sel-venda-prod');
    if (selVenda) {
        selVenda.innerHTML = '<option value="">-- Selecionar Produto --</option>' + produtos.map(p => `<option value="${p.id}">${p.nome} (${p.qtd} un)</option>`).join('');
    }

    // Estoque (com reposição rápida)
    const tbodyEstoque = document.getElementById('tabela-cadastros-corpo');
    if (tbodyEstoque) {
        tbodyEstoque.innerHTML = produtos.map((p, i) => `
            <tr class="${p.qtd < 3 ? 'aviso-estoque' : ''}">
                <td>📦 Produto</td>
                <td>${p.nome}</td>
                <td>${p.qtd} un ${p.qtd < 3 ? '⚠️' : ''}</td>
                <td style="display: flex; gap: 5px;">
                    <input type="number" id="add-qtd-${i}" style="width: 50px; padding: 5px; background: #111; border: 1px solid #333; color: white; border-radius: 4px;" placeholder="+Qtd">
                    <button onclick="reporEstoque(${i})" class="btn-main btn-green" style="padding: 5px; font-size: 0.8rem;">Repor</button>
                    <button onclick="excluir('prod', ${i})" style="color:red; background:none; border:none; cursor:pointer; font-weight:bold; margin-left:10px;">X</button>
                </td>
            </tr>`).join('');
    }
}

function renderizarGrafico() {
    const canvas = document.getElementById('graficoEvolucao');
    if (!canvas || canvas.offsetParent === null) return; 
    
    const ctx = canvas.getContext('2d');
    const dias = {};
    
    transacoes.forEach(t => { 
        if(!dias[t.data]) dias[t.data] = 0; 
        ['Serviço','Produto'].includes(t.cat) ? dias[t.data] += t.valor : dias[t.data] -= t.valor; 
    });
    
    const labels = Object.keys(dias).sort((a,b) => new Date(a.split('/').reverse().join('-')) - new Date(b.split('/').reverse().join('-')));
    
    let acc = 0; 
    const dataPoints = labels.map(l => { acc += dias[l]; return acc; });
    
    if(meuGrafico) meuGrafico.destroy();
    
    meuGrafico = new Chart(ctx, { 
        type: 'line', 
        data: { 
            labels, 
            datasets: [{ 
                label: 'Saldo Acumulado', 
                data: dataPoints, 
                borderColor: '#007acc', 
                backgroundColor: 'rgba(0, 122, 204, 0.1)', 
                fill: true, 
                tension: 0.3 
            }] 
        }, 
        options: { 
            responsive: true, 
            maintainAspectRatio: false,
            scales: {
                y: { grid: { color: '#222' }, ticks: { color: '#888' } },
                x: { grid: { color: '#222' }, ticks: { color: '#888' } }
            }
        } 
    });
}

function renderizarDiario() {
    const mesEl = document.getElementById('filtro-mes-diario');
    const anoEl = document.getElementById('filtro-ano-diario');
    const corpoEl = document.getElementById('corpo-diario');
    
    if(!mesEl || !anoEl || !corpoEl) return;
    
    const d = {};
    const mesFiltro = mesEl.value;
    const anoFiltro = anoEl.value;

    transacoes.filter(t => t.data && t.data.split('/')[1] === mesFiltro && t.data.split('/')[2] === anoFiltro).forEach(t => { 
        if(!d[t.data]) d[t.data] = {in:0, out:0}; 
        ['Serviço','Produto'].includes(t.cat) ? d[t.data].in += t.valor : d[t.data].out += t.valor; 
    });
    
    corpoEl.innerHTML = Object.keys(d).sort().map(k => `<tr><td>${k}</td><td class="positivo">R$ ${d[k].in.toFixed(2)}</td><td class="negativo">R$ ${d[k].out.toFixed(2)}</td><td>R$ ${(d[k].in - d[k].out).toFixed(2)}</td></tr>`).join('');
}

function renderizarMensal() {
    const anoEl = document.getElementById('filtro-ano-mensal');
    const listaEl = document.getElementById('lista-mensal');
    
    if(!anoEl || !listaEl) return;
    
    const m = {};
    const anoFiltro = anoEl.value;

    transacoes.filter(t => t.data && t.data.endsWith(anoFiltro)).forEach(t => { 
        const mes = t.data.substring(3); 
        if(!m[mes]) m[mes] = {in:0, out:0}; 
        ['Serviço','Produto'].includes(t.cat) ? m[mes].in += t.valor : m[mes].out += t.valor; 
    });
    
    listaEl.innerHTML = Object.keys(m).sort().map(k => `
        <div class="card border-blue">
            <h4>${k}</h4>
            <p class="positivo">Entradas: R$ ${m[k].in.toFixed(2)}</p>
            <p class="negativo">Saídas: R$ ${m[k].out.toFixed(2)}</p>
            <b>Saldo: R$ ${(m[k].in - m[k].out).toFixed(2)}</b>
        </div>`).join('');
}

/**
 * BACKUP E EXPORTAÇÕES (JSON E PDF)
 */
function exportarDados() {
    const blob = new Blob([JSON.stringify({ transacoes, produtos, historicoCapital }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); 
    a.href = URL.createObjectURL(blob); 
    a.download = `backup_financas_${new Date().toLocaleDateString().replace(/\//g, '-')}.json`; 
    a.click();
    
    localStorage.setItem('ultimo_backup_data', Date.now()); 
    verificarStatusBackup();
}

function importarDados(input) {
    const reader = new FileReader();
    reader.onload = function() {
        try { 
            const d = JSON.parse(reader.result); 
            if(confirm("Deseja restaurar este backup? O sistema será recarregado.")) { 
                localStorage.setItem('financas_data', JSON.stringify(d.transacoes || [])); 
                localStorage.setItem('meus_produtos', JSON.stringify(d.produtos || [])); 
                localStorage.setItem('capital_historico', JSON.stringify(d.historicoCapital || [])); 
                location.reload(); 
            } 
        } catch(e) { 
            alert("Erro ao importar o arquivo. Verifique se é um backup válido."); 
        }
    };
    reader.readAsText(input.files[0]);
}

function exportarDiarioPDF() {
    if(!window.jspdf) return alert("Biblioteca de PDF não carregada. Verifique sua conexão com a internet.");
    const { jsPDF } = window.jspdf; 
    const doc = new jsPDF(); 
    doc.text("Relatorio Fluxo Diario", 14, 15);
    
    const rows = Array.from(document.querySelectorAll("#corpo-diario tr")).map(tr => Array.from(tr.querySelectorAll("td")).map(td => td.innerText));
    doc.autoTable({ head: [['Data', 'Entradas', 'Saidas', 'Saldo']], body: rows, startY: 20 }); 
    doc.save("Fluxo_Diario.pdf");
}

function exportarMensalPDF() {
    if(!window.jspdf) return alert("Biblioteca de PDF não carregada. Verifique sua conexão com a internet.");
    const { jsPDF } = window.jspdf; 
    const doc = new jsPDF(); 
    doc.text("Relatorio Fluxo Mensal", 14, 15);
    
    const rows = Array.from(document.querySelectorAll("#lista-mensal .card")).map(c => [
        c.querySelector("h4").innerText, 
        c.querySelectorAll("p")[0].innerText.replace('Entradas: ', ''), 
        c.querySelectorAll("p")[1].innerText.replace('Saídas: ', ''), 
        c.querySelector("b").innerText.replace('Saldo: ', '')
    ]);
    doc.autoTable({ head: [['Mes', 'Entradas', 'Saidas', 'Saldo']], body: rows, startY: 20 }); 
    doc.save("Fluxo_Mensal.pdf");
}

function verificarStatusBackup() {
    const u = localStorage.getItem('ultimo_backup_data'); 
    const a = document.getElementById('alerta-backup');
    if(!a) return; 
    
    if(!u) { 
        a.innerText = "⚠️ Sem backup realizado!"; 
        return; 
    }
    
    const dias = Math.floor((Date.now() - parseInt(u)) / 86400000); 
    a.innerText = dias >= 7 ? `⚠️ Backup há ${dias} dias!` : `✅ Backup em dia (${dias} d).`;
}

function excluir(tipo, idx) {
    if(confirm("Tem certeza que deseja excluir este registro?")) {
        if(tipo === 'trans') transacoes.splice(idx, 1); 
        else if(tipo === 'prod') produtos.splice(idx, 1); 
        else if(tipo === 'capital') historicoCapital.splice(idx, 1);
        
        atualizarTudo();
    }
}

// Inicializa o mês atual no Fluxo Diário caso a página seja carregada
if (document.getElementById('filtro-mes-diario')) {
    document.getElementById('filtro-mes-diario').value = (new Date().getMonth() + 1).toString().padStart(2, '0');
}

// Inicia todo o sistema
setTimeout(atualizarTudo, 100);