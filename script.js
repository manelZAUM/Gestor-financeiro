// Inicialização de dados vindos do LocalStorage
let transacoes = JSON.parse(localStorage.getItem('financas_data')) || [];
let produtos = JSON.parse(localStorage.getItem('meus_produtos')) || [];
let historicoCapital = JSON.parse(localStorage.getItem('capital_historico')) || [];
let meuGrafico = null;

/**
 * NAVEGAÇÃO ENTRE ABAS
 * Garante a atualização de dados e o redimensionamento do gráfico.
 */
function abrirAba(evt, nome) {
    document.querySelectorAll(".tab-content").forEach(x => x.style.display = "none");
    document.querySelectorAll(".tab-btn").forEach(x => x.classList.remove("active"));
    
    document.getElementById(nome).style.display = "block";
    evt.currentTarget.classList.add("active");
    
    // Atualiza o Dashboard e o Gráfico com um pequeno delay para renderização do DOM
    if (nome === 'aba-dashboard') {
        renderizarDashboard();
        setTimeout(renderizarGrafico, 150);
    }
}

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

    // CÁLCULOS PARA VALIDAÇÃO
    const entradasTotal = transacoes.filter(t => ['Serviço','Produto'].includes(t.cat)).reduce((a,b) => a + b.valor, 0);
    const saidasTotal = transacoes.filter(t => !['Serviço','Produto'].includes(t.cat)).reduce((a,b) => a + b.valor, 0);
    const saldoLiquidoAtual = entradasTotal - saidasTotal;
    const saldoAtualReserva = historicoCapital.reduce((acc, item) => acc + item.valor, 0);
    const saldoDisponivelReal = saldoLiquidoAtual - saldoAtualReserva;

    // CASO 1: Tentar retirar da reserva mais do que ela possui
    if (multiplicador === -1 && valorRaw > saldoAtualReserva) {
        destacarErro(elReservaVisual);
        alert(`Operação negada! Sua reserva de Capital de Giro possui apenas R$ ${saldoAtualReserva.toFixed(2)}.`);
        return;
    }

    // CASO 2: Tentar adicionar à reserva um valor maior do que o saldo disponível em caixa
    if (multiplicador === 1 && valorRaw > saldoDisponivelReal) {
        destacarErro(elSaldoDisp);
        alert(`Operação negada! Seu saldo disponível em caixa (R$ ${saldoDisponivelReal.toFixed(2)}) é insuficiente para aumentar a reserva.`);
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

function destacarErro(elemento) {
    if (elemento) {
        elemento.style.color = "var(--danger)";
        elemento.style.transition = "0.3s";
        setTimeout(() => { elemento.style.color = ""; }, 2000);
    }
}

/**
 * GESTÃO DE ESTOQUE
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

/**
 * LANÇAMENTOS
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
    } else { alert("Sem estoque disponível!"); }
});

document.getElementById('form-saida-geral')?.addEventListener('submit', function(e) {
    e.preventDefault();
    lancar('Saída', document.getElementById('sai-desc').value, document.getElementById('sai-valor').value, document.getElementById('sai-data').value);
    this.reset();
});

function lancar(cat, desc, valor, data) {
    if(!data) return alert("Selecione uma data.");
    transacoes.push({ id: Date.now(), data: data.split('-').reverse().join('/'), desc: desc, valor: parseFloat(valor), cat: cat });
    atualizarTudo();
}

/**
 * RENDERIZAÇÃO E ATUALIZAÇÃO
 */
function atualizarTudo() {
    localStorage.setItem('financas_data', JSON.stringify(transacoes));
    localStorage.setItem('meus_produtos', JSON.stringify(produtos));
    localStorage.setItem('capital_historico', JSON.stringify(historicoCapital));
    
    renderizarDashboard();
    renderizarTabelas();
    renderizarMensal();
    renderizarDiario();
    renderizarGrafico();
    atualizarAnosFiltro();
    verificarStatusBackup();
}

function renderizarDashboard() {
    const ent = transacoes.filter(t => ['Serviço','Produto'].includes(t.cat)).reduce((a,b) => a + b.valor, 0);
    const sai = transacoes.filter(t => !['Serviço','Produto'].includes(t.cat)).reduce((a,b) => a + b.valor, 0);
    
    const totalReservado = historicoCapital.reduce((a,b) => a + b.valor, 0);
    const saldoLiquido = ent - sai;
    const saldoDisponivel = saldoLiquido - totalReservado;

    document.getElementById('total-entradas').innerText = `R$ ${ent.toFixed(2)}`;
    document.getElementById('total-saidas').innerText = `R$ ${sai.toFixed(2)}`;
    document.getElementById('total-capital-reserva').innerText = `R$ ${totalReservado.toFixed(2)}`;
    
    const elDisp = document.getElementById('saldo-disponivel');
    elDisp.innerText = `R$ ${saldoDisponivel.toFixed(2)}`;
    elDisp.className = `valor ${saldoDisponivel >= 0 ? 'positivo' : 'negativo'}`;
    document.getElementById('saldo-liquido-full').innerText = `R$ ${saldoLiquido.toFixed(2)}`;
}

function renderizarTabelas() {
    document.getElementById('tabela-corpo').innerHTML = transacoes.map((t, i) => `<tr><td>${t.data}</td><td>${t.desc}</td><td>${t.cat}</td><td class="${['Serviço','Produto'].includes(t.cat) ? 'positivo' : 'negativo'}">R$ ${t.valor.toFixed(2)}</td><td><button onclick="excluir('trans', ${i})" style="color:red; background:none; border:none; cursor:pointer">X</button></td></tr>`).join('');
    document.getElementById('tabela-capital-corpo').innerHTML = historicoCapital.map((c, i) => `<tr><td>${c.data}</td><td>${c.desc}</td><td class="${c.valor >= 0 ? 'positivo' : 'negativo'}">R$ ${c.valor.toFixed(2)}</td><td><button onclick="excluir('capital', ${i})" style="color:red; background:none; border:none; cursor:pointer">X</button></td></tr>`).join('');
    document.getElementById('sel-venda-prod').innerHTML = '<option value="">-- Selecionar Produto --</option>' + produtos.map(p => `<option value="${p.id}">${p.nome} (${p.qtd} un)</option>`).join('');
    document.getElementById('tabela-cadastros-corpo').innerHTML = produtos.map((p, i) => `<tr class="${p.qtd < 3 ? 'aviso-estoque' : ''}"><td>📦 Produto</td><td>${p.nome}</td><td>${p.qtd} un ${p.qtd < 3 ? '⚠️' : ''}</td><td><button onclick="excluir('prod', ${i})" style="color:red; background:none; border:none; cursor:pointer">X</button></td></tr>`).join('');
}

/**
 * GRÁFICO CRONOLÓGICO (CORRIGIDO)
 */
function renderizarGrafico() {
    const canvas = document.getElementById('graficoEvolucao');
    if (!canvas || canvas.offsetParent === null) return; 

    const ctx = canvas.getContext('2d');
    const dias = {};
    
    transacoes.forEach(t => {
        if(!dias[t.data]) dias[t.data] = 0;
        ['Serviço','Produto'].includes(t.cat) ? dias[t.data] += t.valor : dias[t.data] -= t.valor;
    });

    const labels = Object.keys(dias).sort((a,b) => {
        return new Date(a.split('/').reverse().join('-')) - new Date(b.split('/').reverse().join('-'));
    });

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
    const mes = document.getElementById('filtro-mes-diario').value;
    const ano = document.getElementById('filtro-ano-diario').value;
    const d = {};
    transacoes.filter(t => t.data.split('/')[1] === mes && t.data.split('/')[2] === ano).forEach(t => {
        if(!d[t.data]) d[t.data] = {in:0, out:0};
        ['Serviço','Produto'].includes(t.cat) ? d[t.data].in += t.valor : d[t.data].out += t.valor;
    });
    document.getElementById('corpo-diario').innerHTML = Object.keys(d).sort().map(k => `<tr><td>${k}</td><td class="positivo">R$ ${d[k].in.toFixed(2)}</td><td class="negativo">R$ ${d[k].out.toFixed(2)}</td><td>R$ ${(d[k].in - d[k].out).toFixed(2)}</td></tr>`).join('');
}

function renderizarMensal() {
    const ano = document.getElementById('filtro-ano-mensal').value;
    const m = {};
    transacoes.filter(t => t.data.endsWith(ano)).forEach(t => {
        const mes = t.data.substring(3);
        if(!m[mes]) m[mes] = {in:0, out:0};
        ['Serviço','Produto'].includes(t.cat) ? m[mes].in += t.valor : m[mes].out += t.valor;
    });
    document.getElementById('lista-mensal').innerHTML = Object.keys(m).sort().map(k => `<div class="card border-blue"><h4>${k}</h4><p class="positivo">R$ ${m[k].in.toFixed(2)}</p><p class="negativo">R$ ${m[k].out.toFixed(2)}</p><b>Saldo: R$ ${(m[k].in - m[k].out).toFixed(2)}</b></div>`).join('');
}

/**
 * BACKUP
 */
function exportarDados() {
    const backup = { transacoes, produtos, historicoCapital };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_${new Date().toLocaleDateString().replace(/\//g, '-')}.json`;
    a.click();
    localStorage.setItem('ultimo_backup_data', Date.now());
    verificarStatusBackup();
}

function importarDados(input) {
    const reader = new FileReader();
    reader.onload = function() {
        const d = JSON.parse(reader.result);
        if(confirm("Deseja restaurar este backup?")) {
            localStorage.setItem('financas_data', JSON.stringify(d.transacoes || []));
            localStorage.setItem('meus_produtos', JSON.stringify(d.produtos || []));
            localStorage.setItem('capital_historico', JSON.stringify(d.historicoCapital || []));
            location.reload();
        }
    };
    reader.readAsText(input.files[0]);
}

/**
 * EXPORTAR PDF
 */
function exportarDiarioPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text("Relatório Fluxo Diário", 14, 15);
    const rows = Array.from(document.querySelectorAll("#corpo-diario tr")).map(tr => Array.from(tr.querySelectorAll("td")).map(td => td.innerText));
    doc.autoTable({ head: [['Data', 'In', 'Out', 'Saldo']], body: rows, startY: 20 });
    doc.save("Diario.pdf");
}

function exportarMensalPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text("Mensal", 14, 15);
    const rows = Array.from(document.querySelectorAll("#lista-mensal .card")).map(c => [c.querySelector("h4").innerText, c.querySelectorAll("p")[0].innerText, c.querySelectorAll("p")[1].innerText, c.querySelector("b").innerText]);
    doc.autoTable({ head: [['Mês', 'In', 'Out', 'Saldo']], body: rows, startY: 20 });
    doc.save("Mensal.pdf");
}

function verificarStatusBackup() {
    const ultimo = localStorage.getItem('ultimo_backup_data');
    const alerta = document.getElementById('alerta-backup');
    if(!alerta) return;
    if(!ultimo) { alerta.innerText = "⚠️ Sem backup realizado!"; return; }
    const dias = Math.floor((Date.now() - parseInt(ultimo)) / 86400000);
    alerta.innerText = dias >= 7 ? `⚠️ Backup há ${dias} dias!` : `✅ Backup em dia (${dias} d).`;
}

function atualizarAnosFiltro() {
    const anos = [...new Set(transacoes.map(t => t.data.split('/')[2]))].sort().reverse();
    if(anos.length === 0) anos.push(new Date().getFullYear());
    ['filtro-ano-mensal', 'filtro-ano-diario'].forEach(id => { const select = document.getElementById(id); if(select && !select.innerHTML) select.innerHTML = anos.map(a => `<option value="${a}">${a}</option>`).join(''); });
}

function excluir(tipo, idx) {
    if(confirm("Excluir?")) {
        if(tipo === 'trans') transacoes.splice(idx, 1);
        else if(tipo === 'prod') produtos.splice(idx, 1);
        else if(tipo === 'capital') historicoCapital.splice(idx, 1);
        atualizarTudo();
    }
}

document.getElementById('filtro-mes-diario').value = (new Date().getMonth() + 1).toString().padStart(2, '0');
atualizarTudo();