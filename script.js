import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCk1gRMnnNhHZFIPJKRwDzFFcPL_aYWl78",
  authDomain: "seusitematech.firebaseapp.com",
  projectId: "seusitematech",
  storageBucket: "seusitematech.firebasestorage.app",
  messagingSenderId: "533715411921",
  appId: "1:533715411921:web:6f68032e9f54b037a2b6f0",
  measurementId: "G-4KSGD4M3W0"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Estado Local
let appState = {
    demandas: [],
    clientes: [],
    orcamentos: [],
    transacoes: [],
    solicitacoes: [],
    crmNotasActive: [],
    portfolio: []
};

// COMPONENTE: Diálogo Centralizado de Confirmação & Alertas
function exibirDialogo({ titulo, mensagem, tipo = 'info', confirmacao = false }) {
    return new Promise((resolve) => {
        const overlay = document.getElementById('customDialogOverlay');
        const titleEl = document.getElementById('customDialogTitle');
        const msgEl = document.getElementById('customDialogMessage');
        const btnCancel = document.getElementById('btnCustomDialogCancel');
        const btnConfirm = document.getElementById('btnCustomDialogConfirm');
        const iconEl = document.getElementById('customDialogIcon');

        if (!overlay || !titleEl || !msgEl || !btnCancel || !btnConfirm || !iconEl) {
            if (confirmacao) {
                resolve(confirm(mensagem));
            } else {
                alert(mensagem);
                resolve(true);
            }
            return;
        }

        titleEl.innerText = titulo || (confirmacao ? "Confirmação" : "Aviso");
        msgEl.innerText = mensagem;

        iconEl.innerHTML = '';
        let iconClass = "fa-circle-info text-blue";
        if (tipo === 'success') iconClass = "fa-circle-check text-green";
        if (tipo === 'warning') iconClass = "fa-triangle-exclamation text-yellow";
        if (tipo === 'danger') iconClass = "fa-circle-xmark text-red";
        iconEl.innerHTML = `<i class="fa-solid ${iconClass}"></i>`;

        if (confirmacao) {
            btnCancel.style.display = 'inline-flex';
        } else {
            btnCancel.style.display = 'none';
        }

        overlay.classList.add('active');

        const handleConfirm = () => {
            cleanup();
            resolve(true);
        };
        const handleCancel = () => {
            cleanup();
            resolve(false);
        };

        function cleanup() {
            btnConfirm.removeEventListener('click', handleConfirm);
            btnCancel.removeEventListener('click', handleCancel);
            overlay.classList.remove('active');
        }

        btnConfirm.addEventListener('click', handleConfirm);
        btnCancel.addEventListener('click', handleCancel);
    });
}

// Vincula funções ao escopo global para garantir compatibilidade com módulos ES6
window.Alerta = async function(mensagem, titulo = "Aviso", tipo = "info") {
    return exibirDialogo({ titulo, mensagem, tipo, confirmacao: false });
};

window.Confirmar = async function(mensagem, titulo = "Confirmação", tipo = "warning") {
    return exibirDialogo({ titulo, mensagem, tipo, confirmacao: true });
};

// Funções de controle do Modal de Detalhes da Solicitação
window.verDetalhesSolicitacao = function(id) {
    const sol = appState.solicitacoes.find(s => s.id === id);
    if (!sol) return;

    const content = document.getElementById('request-detail-content');
    if (!content) return;

    const dataEnvio = sol.dataEnvio ? new Date(sol.dataEnvio).toLocaleString('pt-BR') : 'Não informada';
    
    let statusBadge = '';
    if (sol.status === 'Pendente') statusBadge = '<span class="badge badge-progress">Pendente</span>';
    if (sol.status === 'Aceito') statusBadge = '<span class="badge badge-done">Aceito</span>';
    if (sol.status === 'Recusado') statusBadge = '<span class="badge badge-danger">Recusado</span>';

    content.innerHTML = `
        <div class="detail-row"><strong>Status:</strong> ${statusBadge}</div>
        <div class="detail-row"><strong>Nome do Cliente:</strong> ${sol.clienteNome}</div>
        <div class="detail-row"><strong>E-mail:</strong> ${sol.clienteEmail}</div>
        <div class="detail-row"><strong>Telefone:</strong> ${sol.clienteTelefone}</div>
        <div class="detail-row"><strong>Serviço Solicitado:</strong> ${sol.descricaoServico}</div>
        <div class="detail-row"><strong>Data de Envio:</strong> ${dataEnvio}</div>
    `;

    const modal = document.getElementById('requestDetailModal');
    if (modal) modal.style.display = 'flex';
};

window.closeRequestDetailModal = function() {
    const modal = document.getElementById('requestDetailModal');
    if (modal) modal.style.display = 'none';
};

const colDemandas = collection(db, "demandas");
const colClientes = collection(db, "clientes");
const colOrcamentos = collection(db, "orcamentos");
const colTransacoes = collection(db, "transacoes");
const colSolicitacoes = collection(db, "solicitacoes");
const colCrmNotas = collection(db, "crm_notas");
const colPortfolio = collection(db, "portfolio");

let initialLoadFinished = false;
let activeEditClientId = null;
let activeCrmClientId = null;
let unsubscribeCrmListener = null;

// Inicialização segura baseada na sessão segura síncrona
if (sessionStorage.getItem('seusistema_logged_in') === 'true') {
    inicializarListenersFirebase();
}

// Escuta o sinal de autorização enviado do login
window.addEventListener('seusistema_authorized', () => {
    inicializarListenersFirebase();
});

function inicializarListenersFirebase() {
    onSnapshot(colDemandas, (snapshot) => {
        appState.demandas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        render();
    });

    onSnapshot(colClientes, (snapshot) => {
        appState.clientes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        render();
    });

    onSnapshot(colOrcamentos, (snapshot) => {
        appState.orcamentos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        render();
    });

    onSnapshot(colTransacoes, (snapshot) => {
        appState.transacoes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        render();
    });

    onSnapshot(colPortfolio, (snapshot) => {
        appState.portfolio = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderPortfolioAdmin();
    });

    onSnapshot(colSolicitacoes, (snapshot) => {
        const novasSolicitacoes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (initialLoadFinished) {
            const pendentesAtuais = novasSolicitacoes.filter(s => s.status === 'Pendente');
            const pendentesAntigos = appState.solicitacoes.filter(s => s.status === 'Pendente');
            if (pendentesAtuais.length > pendentesAntigos.length) {
                dispararAlertaPopUp(pendentesAtuais[pendentesAtuais.length - 1]);
            }
        }
        appState.solicitacoes = novasSolicitacoes;
        initialLoadFinished = true;
        render();
    });
}

// Pop-up Central de Alerta
function dispararAlertaPopUp(solicitacao) {
    const alertPopup = document.getElementById('alertPopup');
    if (!alertPopup) return;
    
    const alertMsg = document.getElementById('alertPopupMessage');
    const btnAction = document.getElementById('btnAlertPopupAction');

    if (alertMsg) alertMsg.innerHTML = `O cliente <strong>${solicitacao.clienteNome}</strong> enviou uma solicitação de:<br><em>"${solicitacao.descricaoServico}"</em>`;
    alertPopup.classList.add('active');

    if (btnAction) {
        btnAction.onclick = () => {
            alertPopup.classList.remove('active');
            const tabBtn = document.querySelector('[data-tab="solicitacoes-externas"]');
            if (tabBtn) tabBtn.click();
        };
    }
}

// Instâncias de Gráficos Chart.js
let financeChart;
let distributionChart;

function renderCharts() {
    const ctxFinance = document.getElementById('financeChart');
    const ctxDist = document.getElementById('distributionChart');
    
    if (!ctxFinance || !ctxDist) return; 

    const receitasTotais = appState.transacoes.filter(t => t.tipo === 'receita').reduce((sum, t) => sum + parseFloat(t.valor), 0);
    const despesasTotais = appState.transacoes.filter(t => t.tipo === 'despesa').reduce((sum, t) => sum + parseFloat(t.valor), 0);

    if (financeChart) financeChart.destroy();
    if (distributionChart) distributionChart.destroy();

    financeChart = new Chart(ctxFinance.getContext('2d'), {
        type: 'line',
        data: {
            labels: ['Movimento Mensal'],
            datasets: [
                {
                    label: 'Entradas (R$)',
                    data: [receitasTotais],
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'Saídas (R$)',
                    data: [despesasTotais],
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    fill: true,
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { labels: { color: '#ffffff' } } },
            scales: {
                x: { ticks: { color: '#9ca3af' } },
                y: { ticks: { color: '#9ca3af' } }
            }
        }
    });

    distributionChart = new Chart(ctxDist.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: ['Margem Líquida', 'Custos Operacionais'],
            datasets: [{
                data: [Math.max(0, receitasTotais - despesasTotais), despesasTotais],
                backgroundColor: ['#8b5cf6', '#3b82f6'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom', labels: { color: '#ffffff' } } }
        }
    });
}

// Renderização Principal da Interface
function render() {
    const totalReceitas = appState.transacoes.filter(t => t.tipo === 'receita').reduce((sum, t) => sum + parseFloat(t.valor), 0);
    const totalDespesas = appState.transacoes.filter(t => t.tipo === 'despesa').reduce((sum, t) => sum + parseFloat(t.valor), 0);
    
    // Cálculo do caixa
    const saldoLiquido = totalReceitas - totalDespesas;

    // Verificações de segurança dos elementos do painel central
    const countDemAberto = document.getElementById('count-demandas-aberto');
    const countDemNovas = document.getElementById('count-demandas-novas');
    const countServAprovados = document.getElementById('count-servicos-aprovados');
    const countServDesenv = document.getElementById('count-servicos-desenvolvimento');
    const countServTestes = document.getElementById('count-servicos-testes');
    const countServConcluidos = document.getElementById('count-servicos-concluidos');
    const countReceitaTotal = document.getElementById('count-receita-total');

    if (countDemAberto) countDemAberto.innerText = appState.demandas.filter(d => d.etapa !== 'Concluido').length;
    if (countDemNovas) countDemNovas.innerText = appState.demandas.filter(d => d.etapa === 'Aguardando').length;
    if (countServAprovados) countServAprovados.innerText = appState.orcamentos.filter(o => o.status === 'Aprovado').length;
    if (countServDesenv) countServDesenv.innerText = appState.demandas.filter(d => d.etapa === 'Desenvolvimento').length;
    if (countServTestes) countServTestes.innerText = appState.demandas.filter(d => d.etapa === 'Testes').length;
    if (countServConcluidos) countServConcluidos.innerText = appState.demandas.filter(d => d.etapa === 'Concluido').length;
    if (countReceitaTotal) countReceitaTotal.innerText = 'R$ ' + totalReceitas.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

    // Badge do Menu de Solicitações Externas
    const badgeSolicitacoes = document.getElementById('badge-solicitacoes');
    if (badgeSolicitacoes) {
        const pendentes = appState.solicitacoes.filter(s => s.status === 'Pendente').length;
        if (pendentes > 0) {
            badgeSolicitacoes.innerText = pendentes;
            badgeSolicitacoes.style.display = 'block';
        } else {
            badgeSolicitacoes.style.display = 'none';
        }
    }

    // Fila de Solicitações Recebidas
    const listaSolicitacoes = document.getElementById('lista-solicitacoes');
    if (listaSolicitacoes) {
        listaSolicitacoes.innerHTML = '';
        const listaHistorico = document.getElementById('lista-historico-solicitacoes');
        if (listaHistorico) listaHistorico.innerHTML = '';

        appState.solicitacoes.forEach(sol => {
            if (sol.status === 'Pendente') {
                listaSolicitacoes.innerHTML += `
                    <div class="request-card">
                        <div class="request-card-header">
                            <h5>${sol.clienteNome}</h5>
                            <span class="badge badge-new">Pendente</span>
                        </div>
                        <div class="request-card-body">
                            <p><strong>E-mail:</strong> ${sol.clienteEmail} | <strong>Tel:</strong> ${sol.clienteTelefone}</p>
                            <p><strong>Descrição:</strong> ${sol.descricaoServico}</p>
                            <div class="request-card-actions">
                                <button class="btn btn-sm btn-primary btn-orc-solicitacao" data-id="${sol.id}">Vincular Orçamento</button>
                                <button class="btn btn-sm btn-secondary btn-recusar-solicitacao" data-id="${sol.id}">Recusar</button>
                            </div>
                        </div>
                    </div>
                `;
            } else if (listaHistorico) {
                const badgeCor = sol.status === 'Aceito' ? 'badge-done' : 'badge-danger';
                listaHistorico.innerHTML += `
                    <div class="request-card" style="opacity: 0.85;">
                        <div class="request-card-header">
                            <h5>${sol.clienteNome}</h5>
                            <span class="badge ${badgeCor}">${sol.status}</span>
                        </div>
                        <div class="request-card-body">
                            <p><strong>E-mail:</strong> ${sol.clienteEmail}</p>
                            <div class="request-card-actions" style="margin-top: 8px;">
                                <button class="btn btn-sm btn-secondary btn-visualizar-historico" data-id="${sol.id}"><i class="fa-solid fa-eye"></i> Ver Detalhes</button>
                            </div>
                        </div>
                    </div>
                `;
            }
        });

        document.querySelectorAll('.btn-orc-solicitacao').forEach(btn => {
            btn.onclick = () => converterSolicitacaoEmOrcamento(btn.dataset.id);
        });
        document.querySelectorAll('.btn-recusar-solicitacao').forEach(btn => {
            btn.onclick = async () => {
                if (await Confirmar("Deseja recusar esta solicitação externa?", "Recusar Solicitação", "danger")) {
                    await updateDoc(doc(db, "solicitacoes", btn.dataset.id), { status: "Recusado" });
                    await Alerta("Solicitação recusada com sucesso.", "Status Updated", "success");
                }
            };
        });
        document.querySelectorAll('.btn-visualizar-historico').forEach(btn => {
            btn.onclick = () => window.verDetalhesSolicitacao(btn.dataset.id);
        });
    }

    // Linha de Produção (Kanban)
    const columns = {
        'Aguardando': document.getElementById('cards-aguardando'),
        'Desenvolvimento': document.getElementById('cards-desenvolvimento'),
        'Testes': document.getElementById('cards-testes'),
        'Concluido': document.getElementById('cards-concluido')
    };

    if (columns['Aguardando']) {
        Object.values(columns).forEach(col => col.innerHTML = '');

        appState.demandas.forEach(d => {
            const itemHtml = `
                <div class="kanban-item">
                    <h5>${d.titulo}</h5>
                    <span>Ref: ${d.cliente}</span>
                    <div class="kanban-actions">
                        ${d.etapa !== 'Aguardando' ? `<button class="btn btn-sm btn-secondary btn-retornar" data-id="${d.id}"><i class="fa-solid fa-arrow-left"></i></button>` : ''}
                        ${d.etapa !== 'Concluido' ? `<button class="btn btn-sm btn-primary btn-avancar" data-id="${d.id}"><i class="fa-solid fa-arrow-right"></i></button>` : ''}
                        
                        ${(d.etapa === 'Testes' || d.etapa === 'Concluido') ? `
                            <button class="btn btn-sm btn-secondary btn-pedido-final" data-id="${d.id}" title="Gerar Pedido Final (Termo de Entrega)"><i class="fa-solid fa-file-signature"></i></button>
                            <button class="btn btn-sm btn-wpp btn-wpp-entrega" data-id="${d.id}" title="Notificar Entrega WhatsApp"><i class="fa-brands fa-whatsapp"></i></button>
                        ` : ''}
                        
                        <button class="btn btn-sm btn-danger btn-excluir-demanda" data-id="${d.id}"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
            `;
            if (columns[d.etapa]) {
                columns[d.etapa].innerHTML += itemHtml;
            }
        });

        document.querySelectorAll('.btn-avancar').forEach(btn => {
            btn.onclick = () => alterarEtapaDemanda(btn.dataset.id, 'avancar');
        });
        document.querySelectorAll('.btn-retornar').forEach(btn => {
            btn.onclick = () => alterarEtapaDemanda(btn.dataset.id, 'voltar');
        });
        document.querySelectorAll('.btn-pedido-final').forEach(btn => {
            btn.onclick = () => emitirPedidoFinal(btn.dataset.id);
        });
        document.querySelectorAll('.btn-wpp-entrega').forEach(btn => {
            btn.onclick = () => enviarWhatsAppEntrega(btn.dataset.id);
        });
        document.querySelectorAll('.btn-excluir-demanda').forEach(btn => {
            btn.onclick = async () => {
                if (await Confirmar("Deseja realmente excluir esta demanda da linha de produção?", "Excluir Demanda", "danger")) {
                    await deleteDoc(doc(db, "demandas", btn.dataset.id));
                    await Alerta("Demanda removida com sucesso.", "Exclusão Realizada", "success");
                }
            };
        });
    }

    // Tabela de Clientes
    const tabelaClientes = document.getElementById('tabela-clientes');
    if (tabelaClientes) {
        const selectClientesOrcamento = document.getElementById('orc-cliente');
        const selectClientesDemanda = document.getElementById('dem-cliente-ref');

        tabelaClientes.innerHTML = '';
        if (selectClientesOrcamento) selectClientesOrcamento.innerHTML = '<option value="">Selecione um cliente...</option>';
        if (selectClientesDemanda) selectClientesDemanda.innerHTML = '<option value="Nenhum">Nenhum</option>';

        appState.clientes.forEach(c => {
            tabelaClientes.innerHTML += `
                <tr>
                    <td>${c.nome}</td>
                    <td>${c.documento || 'Não Informado'}</td>
                    <td>${c.telefone}</td>
                    <td>${c.cidade || '-'}/${c.uf || '-'}</td>
                    <td>
                        <div style="display: flex; gap: 4px;">
                            <button class="btn btn-sm btn-secondary btn-crm-cliente" data-id="${c.id}" title="Módulo CRM (Linha do Tempo)"><i class="fa-solid fa-clock-rotate-left"></i> CRM</button>
                            <button class="btn btn-sm btn-secondary btn-editar-cliente" data-id="${c.id}" title="Editar"><i class="fa-solid fa-edit"></i></button>
                            <button class="btn btn-sm btn-danger btn-deletar-cliente" data-id="${c.id}" title="Deletar"><i class="fa-solid fa-trash"></i></button>
                    </div>
                    </td>
                </tr>
            `;
            if (selectClientesOrcamento) selectClientesOrcamento.innerHTML += `<option value="${c.nome}" data-id="${c.id}">${c.nome}</option>`;
            if (selectClientesDemanda) selectClientesDemanda.innerHTML += `<option value="${c.nome}">${c.nome}</option>`;
        });

        document.querySelectorAll('.btn-crm-cliente').forEach(btn => {
            btn.onclick = () => openCrmModal(btn.dataset.id);
        });
        document.querySelectorAll('.btn-editar-cliente').forEach(btn => {
            btn.onclick = () => carregarFormClienteParaEdicao(btn.dataset.id);
        });
        document.querySelectorAll('.btn-deletar-cliente').forEach(btn => {
            btn.onclick = async () => {
                if (await Confirmar("Tem certeza de que deseja excluir permanentemente o cadastro deste cliente?", "Excluir Cliente", "danger")) {
                    await deleteDoc(doc(db, "clientes", btn.dataset.id));
                    await Alerta("Cadastro de cliente removido com sucesso.", "Exclusão Realizada", "success");
                }
            };
        });
    }

    // Tabela de Orçamentos
    const tabelaOrcamentos = document.getElementById('tabela-orcamentos');
    if (tabelaOrcamentos) {
        tabelaOrcamentos.innerHTML = '';
        appState.orcamentos.forEach((o, index) => {
            const numSeq = formatarNumSeqOrcamento(index + 1);
            tabelaOrcamentos.innerHTML += `
                <tr>
                    <td>${numSeq}</td>
                    <td>${o.cliente}</td>
                    <td>R$ ${parseFloat(o.valorTotal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    <td>${o.validade.split('-').reverse().join('/')}</td>
                    <td><span class="badge ${o.status === 'Aprovado' ? 'badge-done' : o.status === 'Reprovado' ? 'badge-danger' : 'badge-progress'}">${o.status}</span></td>
                    <td>
                        <div style="display:flex; gap: 4px;">
                            ${o.status === 'Pendente' ? `
                                <button class="btn btn-sm btn-primary btn-aprovar-orc" data-id="${o.id}" title="Aprovar"><i class="fa-solid fa-check"></i></button>
                                <button class="btn btn-sm btn-danger btn-reprovar-orc" data-id="${o.id}" title="Reprovar"><i class="fa-solid fa-xmark"></i></button>
                            ` : ''}
                            
                            <button class="btn btn-sm btn-wpp btn-wpp-proposta" data-id="${o.id}" title="Enviar Proposta WhatsApp"><i class="fa-brands fa-whatsapp"></i></button>
                            <button class="btn btn-sm btn-secondary btn-pdf" data-id="${o.id}" data-idx="${index + 1}" title="Imprimir Orçamento"><i class="fa-solid fa-file-pdf"></i></button>
                            <button class="btn btn-sm btn-danger btn-deletar-orc" data-id="${o.id}"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </td>
                </tr>
            `;
        });

        document.querySelectorAll('.btn-aprovar-orc').forEach(btn => {
            btn.onclick = () => gerenciarStatusOrcamento(btn.dataset.id, 'Aprovado');
        });
        document.querySelectorAll('.btn-reprovar-orc').forEach(btn => {
            btn.onclick = () => gerenciarStatusOrcamento(btn.dataset.id, 'Reprovado');
        });
        document.querySelectorAll('.btn-wpp-proposta').forEach(btn => {
            btn.onclick = () => enviarWhatsAppProposta(btn.dataset.id);
        });
        document.querySelectorAll('.btn-pdf').forEach(btn => {
            btn.onclick = () => emitirPDFOrcamento(btn.dataset.id, parseInt(btn.dataset.idx));
        });
        document.querySelectorAll('.btn-deletar-orc').forEach(btn => {
            btn.onclick = async () => {
                if (await Confirmar("Deseja realmente excluir este orçamento do banco de dados?", "Excluir Orçamento", "danger")) {
                    await deleteDoc(doc(db, "orcamentos", btn.dataset.id));
                    await Alerta("Orçamento removido com sucesso.", "Exclusão Realizada", "success");
                }
            };
        });
    }

    // Tabela Financeira
    const tabelaTransacoes = document.getElementById('tabela-transacoes');
    if (tabelaTransacoes) {
        tabelaTransacoes.innerHTML = '';
        appState.transacoes.forEach(t => {
            tabelaTransacoes.innerHTML += `
                <tr>
                    <td>${t.data.split('-').reverse().join('/')}</td>
                    <td>${t.descricao}</td>
                    <td>${t.tipo === 'receita' ? '<span class="badge badge-done">Receita</span>' : '<span class="badge badge-danger">Despesa</span>'}</td>
                    <td>R$ ${parseFloat(t.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    <td>
                        <button class="btn btn-sm btn-danger btn-deletar-trans" data-id="${t.id}"><i class="fa-solid fa-trash"></i></button>
                    </td>
                </tr>
            `;
        });

        document.querySelectorAll('.btn-deletar-trans').forEach(btn => {
            btn.onclick = async () => {
                if (await Confirmar("Deseja excluir este lançamento financeiro?", "Excluir Lançamento", "danger")) {
                    await deleteDoc(doc(db, "transacoes", btn.dataset.id));
                    await Alerta("Lançamento removido do caixa com sucesso.", "Exclusão Realizada", "success");
                }
            };
        });

        const fluxoRec = document.getElementById('fluxo-receitas');
        const fluxoDes = document.getElementById('fluxo-despesas');
        const fluxoSal = document.getElementById('fluxo-saldo');

        if (fluxoRec) fluxoRec.innerText = 'R$ ' + totalReceitas.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        if (fluxoDes) fluxoDes.innerText = 'R$ ' + totalDespesas.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        if (fluxoSal) fluxoSal.innerText = 'R$ ' + saldoLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    }

    renderCharts();
}

// Formatadores Sequenciais
function formatarNumSeqOrcamento(index) {
    return `#${String(index).padStart(2, '0')}orçamento`;
}

function formatarNumSeqEntrega(index) {
    return `#${String(index).padStart(2, '0')}entregasistemafinal`;
}

function higienizarNomeArquivo(nome) {
    return nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '');
}

// Lógica de Notificação via WhatsApp
function enviarWhatsAppProposta(orcamentoId) {
    const o = appState.orcamentos.find(item => item.id === orcamentoId);
    if (!o) return;

    const index = appState.orcamentos.findIndex(item => item.id === orcamentoId) + 1;
    const numSeq = formatarNumSeqOrcamento(index);

    const telefoneLimpo = o.clienteTel.replace(/\D/g, '');
    if (!telefoneLimpo) {
        alert("Erro: Este cliente não possui telefone/celular cadastrado.");
        return;
    }

    const mensagemText = `Olá, ${o.cliente}! Tudo bem? 

Escrevo para enviar a proposta comercial ${numSeq} referente ao escopo de seu projeto de desenvolvimento de sistemas.
O investimento total estimado é de R$ ${parseFloat(o.valorTotal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.

Ficamos inteiramente à disposição para alinhar os detalhes técnicos.

Atenciosamente,
Equipe Seu Sistema`;

    const url = `https://api.whatsapp.com/send?phone=55${telefoneLimpo}&text=${encodeURIComponent(mensagemText)}`;
    window.open(url, '_blank');
}

function enviarWhatsAppEntrega(demandaId) {
    const d = appState.demandas.find(item => item.id === demandaId);
    if (!d) return;

    let index = appState.demandas.findIndex(item => item.id === demandaId) + 1;
    const numSeq = formatarNumSeqEntrega(index);

    let telefone = '';
    const cliRef = appState.clientes.find(c => c.nome === d.cliente);
    if (cliRef) {
        telefone = cliRef.telefone;
    } else if (d.orcamentoId) {
        const oRef = appState.orcamentos.find(o => o.id === d.orcamentoId);
        if (oRef) telefone = oRef.clienteTel;
    }

    const telefoneLimpo = telefone.replace(/\D/g, '');
    if (!telefoneLimpo) {
        alert("Erro: Este cliente não possui telefone/celular cadastrado.");
        return;
    }

    const mensagemText = `Olá, ${d.cliente}! 

Temos uma excelente notícia! O desenvolvimento de seu produto digital ("${d.titulo}") foi finalizado com sucesso.

Enviamos em anexo o Termo de Homologação e Encerramento Técnico ${numSeq} para validação e assinatura digital.

Atenciosamente,
Equipe Seu Sistema`;

    const url = `https://api.whatsapp.com/send?phone=55${telefoneLimpo}&text=${encodeURIComponent(mensagemText)}`;
    window.open(url, '_blank');
}

// MÓDULO CRM
window.openCrmModal = function(clientId) {
    const c = appState.clientes.find(item => item.id === clientId);
    if (!c) return;

    activeCrmClientId = clientId;
    document.getElementById('crm-cliente-identificacao').innerHTML = `<strong>Cliente:</strong> ${c.nome} | <strong>WhatsApp:</strong> ${c.telefone}`;
    document.getElementById('crmModal').style.display = 'flex';

    if (unsubscribeCrmListener) {
        unsubscribeCrmListener();
    }

    const q = query(colCrmNotas, where("clienteId", "==", clientId));
    unsubscribeCrmListener = onSnapshot(q, (snapshot) => {
        const notas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        notas.sort((a, b) => new Date(b.dataCriacao) - new Date(a.dataCriacao));
        appState.crmNotasActive = notas;
        renderCrmTimeline();
    });
};

window.closeCrmModal = function() {
    document.getElementById('crmModal').style.display = 'none';
    if (unsubscribeCrmListener) {
        unsubscribeCrmListener();
        unsubscribeCrmListener = null;
    }
    activeCrmClientId = null;
};

document.getElementById('form-crm-nota').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!activeCrmClientId) return;

    const textoNota = document.getElementById('crm-nota-texto').value;

    await addDoc(colCrmNotas, {
        clienteId: activeCrmClientId,
        texto: textoNota,
        dataCriacao: new Date().toISOString(),
        autor: "Administrador"
    });

    document.getElementById('crm-nota-texto').value = '';
});

function renderCrmTimeline() {
    const listaHtml = document.getElementById('crm-timeline-lista');
    if (!listaHtml) return;
    listaHtml.innerHTML = '';

    if (appState.crmNotasActive.length === 0) {
        listaHtml.innerHTML = `<p style="color: var(--text-muted); font-size: 0.85rem; text-align: center;">Nenhum atendimento registrado para este cliente.</p>`;
        return;
    }

    appState.crmNotasActive.forEach(nota => {
        const dataFormatada = new Date(nota.dataCriacao).toLocaleString('pt-BR');
        listaHtml.innerHTML += `
            <div class="crm-timeline-item">
                <div class="crm-timeline-meta">${dataFormatada} - Por ${nota.autor}</div>
                <div class="crm-timeline-body">${nota.texto}</div>
            </div>
        `;
    });
}

// Controle de Produção
async function alterarEtapaDemanda(id, acao) {
    const etapasDisponiveis = ['Aguardando', 'Desenvolvimento', 'Testes', 'Concluido'];
    const dRef = appState.demandas.find(d => d.id === id);
    if (!dRef) return;

    let indexAtual = etapasDisponiveis.indexOf(dRef.etapa);
    const etapaAntiga = etapasDisponiveis[indexAtual];

    if (acao === 'avancar' && indexAtual < etapasDisponiveis.length - 1) {
        indexAtual++;
    } else if (acao === 'voltar' && indexAtual > 0) {
        indexAtual--;
    }

    const novaEtapa = etapasDisponiveis[indexAtual];
    await updateDoc(doc(db, "demandas", id), { etapa: novaEtapa });

    if (novaEtapa === 'Concluido' && etapaAntiga !== 'Concluido') {
        if (dRef.orcamentoId) {
            const orcRef = appState.orcamentos.find(o => o.id === dRef.orcamentoId);
            if (orcRef) {
                await addDoc(colTransacoes, {
                    descricao: `Faturamento - Conclusão de Serviço ref. Orçamento #${dRef.orcamentoId.substring(0,5)}`,
                    tipo: 'receita',
                    valor: orcRef.valorTotal,
                    data: new Date().toISOString().split('T')[0]
                });
                await Alerta(`Demanda finalizada! Uma receita de R$ ${orcRef.valorTotal.toLocaleString('pt-BR', {minimumFractionDigits: 2})} correspondente ao orçamento foi gerada com sucesso.`, "Entrega de Demanda", "success");
            }
        }
    }
}

// Clientes - Programação Defensiva
const formClienteC = document.getElementById('form-cliente');
if (formClienteC) {
    formClienteC.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const acaoLabel = activeEditClientId ? "atualizar" : "cadastrar";
        if (!(await Confirmar(`Deseja realmente ${acaoLabel} este cliente no sistema?`, "Confirmação de Cadastro", "info"))) {
            return;
        }

        const payload = {
            nome: document.getElementById('client-name').value,
            documento: document.getElementById('client-document').value,
            email: document.getElementById('client-email').value,
            telefone: document.getElementById('client-phone').value,
            cep: document.getElementById('client-cep').value,
            endereco: document.getElementById('client-address').value,
            cidade: document.getElementById('client-city').value,
            uf: document.getElementById('client-uf').value.toUpperCase()
        };

        if (activeEditClientId) {
            await updateDoc(doc(db, "clientes", activeEditClientId), payload);
            cancelarEdicaoCliente();
            await Alerta("Cadastro do cliente atualizado com sucesso!", "Cliente Updated", "success");
        } else {
            await addDoc(colClientes, payload);
            e.target.reset();
            await Alerta("Novo cliente adicionado com sucesso!", "Cliente Cadastrado", "success");
        }
    });
}

function carregarFormClienteParaEdicao(id) {
    const c = appState.clientes.find(item => item.id === id);
    if (!c) return;

    activeEditClientId = id;
    document.getElementById('edit-client-id').value = id;
    document.getElementById('client-name').value = c.nome;
    document.getElementById('client-document').value = c.documento || '';
    document.getElementById('client-email').value = c.email || '';
    document.getElementById('client-phone').value = c.telefone;
    document.getElementById('client-cep').value = c.cep || '';
    document.getElementById('client-address').value = c.endereco || '';
    document.getElementById('client-city').value = c.cidade || '';
    document.getElementById('client-uf').value = c.uf || '';

    document.getElementById('form-cliente-title').innerText = "Editar Cliente";
    document.getElementById('btn-submit-cliente').innerText = "Atualizar Cadastro";
    document.getElementById('btn-cancel-edit').style.display = 'inline-flex';

    const tabBtn = document.querySelector('[data-tab="clientes"]');
    if (tabBtn) tabBtn.click();
}

const btnCancelEdit = document.getElementById('btn-cancel-edit');
if (btnCancelEdit) {
    btnCancelEdit.onclick = cancelarEdicaoCliente;
}

function cancelarEdicaoCliente() {
    activeEditClientId = null;
    const formC = document.getElementById('form-cliente');
    if (formC) formC.reset();
    
    const editIdInput = document.getElementById('edit-client-id');
    const titleForm = document.getElementById('form-cliente-title');
    const submitBtn = document.getElementById('btn-submit-cliente');
    const cancelBtn = document.getElementById('btn-cancel-edit');

    if (editIdInput) editIdInput.value = '';
    if (titleForm) titleForm.innerText = "Cadastrar Novo Cliente";
    if (submitBtn) submitBtn.innerText = "Salvar Cliente";
    if (cancelBtn) cancelBtn.style.display = 'none';
}

// Converter Solicitação Externa em Orçamento
async function converterSolicitacaoEmOrcamento(solId) {
    const sol = appState.solicitacoes.find(s => s.id === solId);
    if (!sol) return;

    if (!(await Confirmar(`Deseja vincular a solicitação de "${sol.clienteNome}" e criar um orçamento?`, "Vincular Solicitação", "info"))) {
        return;
    }

    let clienteExistente = appState.clientes.find(c => c.nome.toLowerCase() === sol.clienteNome.toLowerCase());
    
    if (!clienteExistente) {
        await addDoc(colClientes, {
            nome: sol.clienteNome,
            email: sol.clienteEmail,
            telefone: sol.clienteTelefone,
            documento: '',
            cep: '',
            endereco: '',
            cidade: '',
            uf: ''
        });
        await Alerta(`Cliente "${sol.clienteNome}" cadastrado de forma automática.`, "Importação de Leads", "success");
    }

    const btnTabOrc = document.querySelector('[data-tab="orcamentos"]');
    if (btnTabOrc) btnTabOrc.click();

    setTimeout(() => {
        const selectCli = document.getElementById('orc-cliente');
        if (selectCli) selectCli.value = sol.clienteNome;
        
        const container = document.getElementById('orc-itens-container');
        if (container) {
            container.innerHTML = '';
            adicionarLinhaItem();
            
            setTimeout(() => {
                const primeiraLinha = container.querySelector('.item-row');
                if (primeiraLinha) {
                    const descInput = primeiraLinha.querySelector('.item-desc');
                    if (descInput) descInput.value = sol.descricaoServico;
                }
            }, 50);
        }
    }, 150);

    await updateDoc(doc(db, "solicitacoes", solId), { status: "Aceito" });
}

// Gestão de Orçamentos
async function gerenciarStatusOrcamento(id, novoStatus) {
    const oRef = appState.orcamentos.find(o => o.id === id);
    if (!oRef) return;

    const rotuloAcao = novoStatus === 'Aprovado' ? "aprovar" : "reprovar";
    const statusCor = novoStatus === 'Aprovado' ? "success" : "danger";

    if (!(await Confirmar(`Deseja realmente ${rotuloAcao} o orçamento do cliente "${oRef.cliente}"?`, "Gerenciar Orçamento", statusCor))) {
        return;
    }

    await updateDoc(doc(db, "orcamentos", id), { status: novoStatus });

    if (novoStatus === 'Aprovado') {
        await addDoc(colDemandas, {
            titulo: `${oRef.itens[0].descricao} (Projeto #${id.substring(0, 5)})`,
            cliente: oRef.cliente,
            etapa: 'Aguardando',
            orcamentoId: id
        });
        await Alerta("Orçamento aprovado! Projeto encaminhado para a Linha de Produção.", "Sucesso Comercial", "success");
    } else {
        await Alerta("Orçamento marcado como reprovado no sistema.", "Status Atualizado", "info");
    }
}

// Simulador de Envio de Solicitação
const formSim = document.getElementById('form-simulador-cliente');
if (formSim) {
    formSim.addEventListener('submit', async (e) => {
        e.preventDefault();
        await addDoc(colSolicitacoes, {
            clienteNome: document.getElementById('sim-nome').value,
            clienteEmail: document.getElementById('sim-email').value,
            clienteTelefone: document.getElementById('sim-tel').value,
            descricaoServico: document.getElementById('sim-servico').value,
            status: 'Pendente',
            dataEnvio: new Date().toISOString()
        });
        e.target.reset();
        await Alerta("Simulação enviada com sucesso! O pop-up em tempo real aparecerá em instantes.", "Simulador de Site", "success");
    });
}

// Manipulação das Linhas de Itens no Orçamento
window.adicionarLinhaItem = function() {
    const container = document.getElementById('orc-itens-container');
    if (!container) return;
    
    const rowId = Date.now();
    const itemRow = document.createElement('div');
    itemRow.className = 'item-row';
    itemRow.id = `row-${rowId}`;
    itemRow.innerHTML = `
        <div class="form-group">
            <label>Item / Serviço</label>
            <input type="text" class="item-desc" required placeholder="Ex: Desenvolvimento de API">
        </div>
        <div class="form-group">
            <label>Qtd</label>
            <input type="number" class="item-qtd" min="1" value="1" required>
        </div>
        <div class="form-group">
            <label>Valor Unitário (R$)</label>
            <input type="number" step="0.01" class="item-val" required placeholder="0.00">
        </div>
        <div class="form-group">
            <button type="button" class="btn btn-danger btn-sm" onclick="removerLinhaItem(${rowId})"><i class="fa-solid fa-xmark"></i></button>
        </div>
    `;
    container.appendChild(itemRow);

    itemRow.querySelector('.item-qtd').addEventListener('input', calcularTotalOrcamento);
    itemRow.querySelector('.item-val').addEventListener('input', calcularTotalOrcamento);
};

window.removerLinhaItem = function(rowId) {
    const row = document.getElementById(`row-${rowId}`);
    if (row) {
        row.remove();
        calcularTotalOrcamento();
    }
};

function calcularTotalOrcamento() {
    let total = 0;
    const rows = document.querySelectorAll('.item-row');
    rows.forEach(row => {
        const qty = parseFloat(row.querySelector('.item-qtd').value) || 0;
        const val = parseFloat(row.querySelector('.item-val').value) || 0;
        total += qty * val;
    });
    const totalCalc = document.getElementById('orc-total-calc');
    if (totalCalc) totalCalc.innerText = 'R$ ' + total.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
}

const formOrc = document.getElementById('form-orcamento');
if (formOrc) {
    formOrc.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!(await Confirmar("Deseja realmente gerar e salvar este orçamento?", "Salvar Orçamento", "info"))) {
            return;
        }

        const clienteSelect = document.getElementById('orc-cliente');
        const cliRef = appState.clientes.find(c => c.nome === clienteSelect.value);

        const items = [];
        document.querySelectorAll('.item-row').forEach(row => {
            items.push({
                descricao: row.querySelector('.item-desc').value,
                quantidade: parseInt(row.querySelector('.item-qtd').value),
                valorUnitario: parseFloat(row.querySelector('.item-val').value)
            });
        });

        if (items.length === 0) {
            await Alerta("Adicione pelo menos um item ao orçamento.", "Alerta Técnico", "warning");
            return;
        }

        const totalCalculado = items.reduce((sum, item) => sum + (item.quantidade * item.valorUnitario), 0);

        await addDoc(colOrcamentos, {
            cliente: clienteSelect.value,
            clienteEmail: cliRef ? cliRef.email : '',
            clienteTel: cliRef ? cliRef.telefone : '',
            clienteDoc: cliRef ? cliRef.documento : '',
            clienteEnd: cliRef ? `${cliRef.endereco || ''}, ${cliRef.cidade || ''}/${cliRef.uf || ''}` : '',
            validade: document.getElementById('orc-validade').value,
            itens: items,
            valorTotal: totalCalculado,
            status: 'Pendente',
            metodoPagamento: document.getElementById('orc-pagamento').value
        });

        const container = document.getElementById('orc-itens-container');
        if (container) container.innerHTML = '';
        
        const totalCalc = document.getElementById('orc-total-calc');
        if (totalCalc) totalCalc.innerText = 'R$ 0,00';
        
        e.target.reset();
        await Alerta("Orçamento gravado no Firebase com sucesso!", "Documento Criado", "success");
    });
}

const formTran = document.getElementById('form-transacao');
if (formTran) {
    formTran.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!(await Confirmar("Deseja registrar este lançamento financeiro no caixa?", "Salvar Transação", "info"))) {
            return;
        }

        await addDoc(colTransacoes, {
            descricao: document.getElementById('trans-desc').value,
            tipo: document.getElementById('trans-tipo').value,
            valor: parseFloat(document.getElementById('trans-valor').value),
            data: document.getElementById('trans-data').value
        });
        e.target.reset();
        await Alerta("Lançamento de fluxo de caixa registrado com sucesso!", "Lançamento Salvo", "success");
    });
}

// Desenhar Molduras e Cabeçalho Estilizado (Symmetric & Pro Grid Lines)
function desenharCabecalhoTimbradoPro(docPdf, tituloDocumento, numeroRegistro) {
    docPdf.setDrawColor(226, 232, 240);
    docPdf.setLineWidth(0.4);
    docPdf.rect(8, 8, 194, 281);

    // Bloco Superior Sólido Escuro
    docPdf.setFillColor(15, 23, 42);
    docPdf.rect(8, 8, 194, 38, 'F');

    // Faixa divisória roxa
    docPdf.setFillColor(139, 92, 246);
    docPdf.rect(8, 46, 194, 3, 'F');

    // Texto de identificação da empresa
    docPdf.setTextColor(255, 255, 255);
    docPdf.setFont("Helvetica", "bold");
    docPdf.setFontSize(18);
    docPdf.text("Seu Sistema", 14, 25);

    docPdf.setFontSize(8.5);
    docPdf.setTextColor(156, 163, 175);
    docPdf.text("DESENVOLVIMENTO DE SOFTWARE E SISTEMAS WEB", 14, 33);

    // Logomarca Vetorial de Código < / > Centralizada no Canto Direito
    docPdf.setFillColor(139, 92, 246);
    docPdf.circle(185, 27, 9, 'F');
    docPdf.setTextColor(255, 255, 255);
    docPdf.setFont("Helvetica", "bold");
    docPdf.setFontSize(10.5);
    docPdf.text("< / >", 180.5, 30.5);

    // Faixa de Rodapé Escura do Papel Timbrado
    docPdf.setFillColor(15, 23, 42);
    docPdf.rect(8, 281, 194, 8, 'F');

    // Título e Identificação do Documento
    docPdf.setFontSize(14);
    docPdf.setTextColor(139, 92, 246);
    docPdf.setFont("Helvetica", "bold");
    docPdf.text(`${tituloDocumento} ${numeroRegistro.toUpperCase()}`, 14, 60);
    
    docPdf.setFontSize(9);
    docPdf.setTextColor(100, 116, 139);
    docPdf.setFont("Helvetica", "normal");
    docPdf.text(`Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}`, 14, 66);
}

// Gerador de Orçamento em PDF Profissional
function emitirPDFOrcamento(id, indexSequencial) {
    const oRef = appState.orcamentos.find(o => o.id === id);
    if (!oRef) return;

    const { jsPDF } = window.jspdf;
    const docPdf = new jsPDF();

    const numSeq = formatarNumSeqOrcamento(indexSequencial);

    desenharCabecalhoTimbradoPro(docPdf, "ORÇAMENTO", numSeq);

    // Ficha do Cliente
    docPdf.setDrawColor(226, 232, 240);
    docPdf.setFillColor(248, 250, 252);
    docPdf.roundedRect(14, 72, 182, 45, 3, 3, 'FD');

    docPdf.setFontSize(11);
    docPdf.setTextColor(15, 23, 42);
    docPdf.setFont("Helvetica", "bold");
    docPdf.text("DADOS DO CLIENTE CONTRATANTE", 20, 81);

    docPdf.setFontSize(9.5);
    docPdf.setTextColor(71, 85, 105);
    docPdf.text(`Nome / Razão Social: ${oRef.cliente}`, 20, 88);
    docPdf.text(`CPF/CNPJ: ${oRef.clienteDoc || 'Não Informado'}`, 20, 94);
    docPdf.text(`Contato: ${oRef.clienteTel || 'Não Informado'}`, 20, 100);
    docPdf.text(`E-mail: ${oRef.clienteEmail || 'Não Informado'}`, 20, 106);
    docPdf.text(`Endereço: ${oRef.clienteEnd || 'Não Informado'}`, 20, 112);

    // Tabela de Serviços Estruturada
    const tableBody = oRef.itens.map(item => [
        item.descricao,
        `R$ ${parseFloat(item.valorUnitario).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
    ]);

    docPdf.autoTable({
        startY: 124,
        head: [['Especificação Técnica / Escopo do Projeto', 'Valor']],
        body: tableBody,
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [255, 255, 255] },
        styles: { fontSize: 9.5, cellPadding: 6, font: 'Helvetica' },
        gridLineWidth: 0.5,
        theme: 'grid', 
        margin: { left: 14, right: 14 }
    });

    const finalY = docPdf.lastAutoTable.finalY + 8;

    // Banner de Investimento Destacado
    docPdf.setDrawColor(139, 92, 246);
    docPdf.setFillColor(245, 243, 255);
    docPdf.rect(14, finalY, 182, 12, 'FD');

    docPdf.setFont("Helvetica", "bold");
    docPdf.setTextColor(139, 92, 246);
    docPdf.setFontSize(11);
    docPdf.text(`INVESTIMENTO TOTAL ESTIMADO: R$ ${parseFloat(oRef.valorTotal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 18, finalY + 8);

    // Box de Termos, Métodos de Pagamento e Assinatura
    const infoBoxY = finalY + 22;
    docPdf.setDrawColor(226, 232, 240);
    docPdf.setFillColor(255, 255, 255);
    docPdf.rect(14, infoBoxY, 182, 60);

    // Coluna Esquerda: Detalhes Gerais
    docPdf.setFontSize(9.5);
    docPdf.setFont("Helvetica", "bold");
    docPdf.setTextColor(15, 23, 42);
    docPdf.text("FORMA DE PAGAMENTO:", 20, infoBoxY + 8);
    docPdf.setFont("Helvetica", "normal");
    docPdf.text(oRef.metodoPagamento || "À vista via PIX", 20, infoBoxY + 14);

    docPdf.setFont("Helvetica", "bold");
    docPdf.text("TERMOS E CONDIÇÕES:", 20, infoBoxY + 26);
    docPdf.setFont("Helvetica", "normal");
    docPdf.text("Validade técnica e comercial deste orçamento: 15 dias.", 20, infoBoxY + 32);

    docPdf.setFont("Helvetica", "bold");
    docPdf.text("OBSERVAÇÕES:", 20, infoBoxY + 44);
    docPdf.setFont("Helvetica", "normal");
    docPdf.text("Pagamento inicial efetuado no início do cronograma técnico.", 20, infoBoxY + 50);

    // Linha de Divisão Interna do Box
    docPdf.setDrawColor(226, 232, 240);
    docPdf.line(110, infoBoxY, 110, infoBoxY + 60);

    // Coluna Direita: Dados de Assinatura da Empresa
    docPdf.setFont("Helvetica", "bold");
    docPdf.setTextColor(139, 92, 246);
    docPdf.text("SEU SISTEMA", 116, infoBoxY + 8);
    
    docPdf.setFont("Helvetica", "normal");
    docPdf.setTextColor(100, 116, 139);
    docPdf.text("Serviços Técnicos e Publicações", 116, infoBoxY + 14);
    docPdf.text("contato@seusistema.tech", 116, infoBoxY + 20);

    // Linha de Assinatura Técnica do Responsável
    docPdf.setDrawColor(203, 213, 225);
    docPdf.line(116, infoBoxY + 44, 186, infoBoxY + 44);
    docPdf.setFontSize(8);
    docPdf.text("Assinatura do Responsável Técnico", 116, infoBoxY + 49);

    const nomeSalvar = higienizarNomeArquivo(oRef.cliente);
    docPdf.save(`orçamento_${nomeSalvar}.pdf`);
}

// Gerador de Pedido Final (Termo de Entrega e Aceite Técnico)
function emitirPedidoFinal(demandaId) {
    const dRef = appState.demandas.find(d => d.id === demandaId);
    if (!dRef) return;

    let oRef = null;
    if (dRef.orcamentoId) {
        oRef = appState.orcamentos.find(o => o.id === dRef.orcamentoId);
    }

    const { jsPDF } = window.jspdf;
    const docPdf = new jsPDF();

    let index = appState.demandas.findIndex(item => item.id === demandaId) + 1;
    const numSeq = formatarNumSeqEntrega(index);

    desenharCabecalhoTimbradoPro(docPdf, "TERMO DE ENTREGA", numSeq);

    // Ficha do Cliente e Escopo Homologado
    docPdf.setDrawColor(226, 232, 240);
    docPdf.setFillColor(248, 250, 252);
    docPdf.roundedRect(14, 72, 182, 45, 3, 3, 'FD');

    docPdf.setFontSize(11);
    docPdf.setTextColor(15, 23, 42);
    docPdf.setFont("Inter", "bold");
    docPdf.text("DADOS DO CONTRATANTE E PROJETO", 20, 81);

    docPdf.setFont("Inter", "normal");
    docPdf.setFontSize(9.5);
    docPdf.setTextColor(71, 85, 105);
    docPdf.text(`Cliente: ${dRef.cliente}`, 20, 88);
    if (oRef) {
        docPdf.text(`CPF/CNPJ: ${oRef.clienteDoc || 'Não Informado'}`, 20, 94);
        docPdf.text(`Endereço: ${oRef.clienteEnd || 'Não Informado'}`, 20, 100);
    }
    docPdf.text(`Escopo Entregue: ${dRef.titulo}`, 20, 106);

    // Caixa de Declaração de Homologação
    docPdf.setDrawColor(16, 185, 129); // Verde de Homologação
    docPdf.setFillColor(240, 253, 250);
    docPdf.rect(14, 124, 182, 44, 'FD');

    docPdf.setFontSize(10.5);
    docPdf.setFont("Helvetica", "bold");
    docPdf.setTextColor(6, 95, 70);
    docPdf.text("DECLARAÇÃO DE RECEBIMENTO E ACEITE TÉCNICO", 18, 132);

    docPdf.setFont("Helvetica", "normal");
    docPdf.setFontSize(9.5);
    docPdf.setTextColor(55, 65, 81);
    
    docPdf.text("Por meio deste termo, o cliente acima qualificado declara que o sistema / website", 18, 140);
    docPdf.text("descrito foi totalmente homologado, testado e recebido em perfeito funcionamento técnico,", 18, 145);
    docPdf.text("autorizando o encerramento do desenvolvimento e entrega formal das chaves de acesso.", 18, 150);
    docPdf.text("Este aceite técnico encerra os compromissos de implantação da proposta original.", 18, 155);

    // Box de Assinaturas Duplas Simétricas
    const signBoxY = 176;
    docPdf.setDrawColor(226, 232, 240);
    docPdf.setFillColor(255, 255, 255);
    docPdf.rect(14, signBoxY, 182, 50);

    // Assinatura do Cliente
    docPdf.setDrawColor(203, 213, 225);
    docPdf.line(20, signBoxY + 32, 90, signBoxY + 32);
    
    docPdf.setFontSize(9);
    docPdf.setFont("Helvetica", "bold");
    docPdf.setTextColor(15, 23, 42);
    docPdf.text("Assinatura do Cliente / Contratante", 20, signBoxY + 38);
    docPdf.setFont("Helvetica", "normal");
    docPdf.setTextColor(100, 116, 139);
    docPdf.text(dRef.cliente, 20, signBoxY + 43);

    // Assinatura do Técnico
    docPdf.line(110, signBoxY, 110, signBoxY + 50); // Divisor de colunas
    docPdf.line(116, signBoxY + 32, 186, signBoxY + 32);

    docPdf.setFont("Helvetica", "bold");
    docPdf.setTextColor(15, 23, 42);
    docPdf.text("Responsável Técnico / Seu Sistema", 116, signBoxY + 38);
    docPdf.setFont("Helvetica", "normal");
    docPdf.setTextColor(100, 116, 139);
    docPdf.text("Departamento de Projetos", 116, signBoxY + 43);

    const nomeSalvar = higienizarNomeArquivo(dRef.cliente);
    docPdf.save(`pedidofinal_${nomeSalvar}.pdf`);
}

// Função de Compactação de Imagem CMS
function otimizarEConverterImagem(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 600; 
                let width = img.width;
                let height = img.height;

                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                const compressedBase64 = canvas.toDataURL('image/jpeg', 0.6);
                resolve(compressedBase64);
            };
        };
        reader.onerror = error => reject(error);
    });
}

// Lógica de Salvamento de Portfólio (CMS Admin) - Programação Defensiva
const formPort = document.getElementById('form-portfolio-cms');
if (formPort) {
    formPort.addEventListener('submit', async (e) => {
        e.preventDefault();

        const titulo = document.getElementById('port-titulo').value.trim();
        const descricao = document.getElementById('port-desc').value.trim();
        const fotoInput = document.getElementById('port-foto').files[0];

        if (!fotoInput) return;

        if (!(await Confirmar("Deseja realmente publicar este projeto no seu portfólio público?", "Publicar Portfólio", "info"))) {
            return;
        }

        try {
            const imagemBase64 = await otimizarEConverterImagem(fotoInput);

            await addDoc(colPortfolio, {
                titulo,
                descricao,
                imagemBase64,
                dataPublicacao: new Date().toISOString()
            });

            formPort.reset();
            await Alerta("Projeto publicado no portfólio com sucesso!", "CMS Updated", "success");

        } catch (error) {
            console.error(error);
            await Alerta("Erro ao salvar projeto no portfólio.", "Erro Técnico", "danger");
        }
    });
}

// Renderização do Portfólio no Painel Administrativo para Exclusão
function renderPortfolioAdmin() {
    const tabela = document.getElementById('tabela-portfolio-admin');
    if (!tabela) return;

    tabela.innerHTML = '';
    appState.portfolio.forEach(p => {
        tabela.innerHTML += `
            <tr>
                <td><strong>${p.titulo}</strong></td>
                <td>
                    <button class="btn btn-sm btn-danger btn-deletar-portfolio" data-id="${p.id}"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>
        `;
    });

    document.querySelectorAll('.btn-deletar-portfolio').forEach(btn => {
        btn.onclick = async () => {
            if (await Confirmar("Deseja excluir este projeto do seu portfólio público?", "Deletar Portfólio", "danger")) {
                await deleteDoc(doc(db, "portfolio", btn.dataset.id));
                await Alerta("Projeto removido do portfólio com sucesso.", "Removido", "success");
            }
        };
    });
}

// Navegação entre Abas
const menuItems = document.querySelectorAll('.menu-item');
const tabContents = document.querySelectorAll('.tab-content');
const pageTitle = document.getElementById('page-title');

menuItems.forEach(item => {
    item.addEventListener('click', () => {
        menuItems.forEach(i => i.classList.remove('active'));
        tabContents.forEach(tab => tab.classList.remove('active'));

        item.classList.add('active');
        const tabId = item.getAttribute('data-tab');
        document.getElementById(tabId).classList.add('active');

        if (pageTitle) pageTitle.innerText = item.querySelector('span').innerText;

        if (window.innerWidth <= 768) {
            const sbar = document.getElementById('sidebar');
            const sbarOverlay = document.getElementById('sidebarOverlay');
            if (sbar) sbar.classList.remove('active');
            if (sbarOverlay) sbarOverlay.classList.remove('active');
        }
    });
});

// Menu Responsivo Mobile
const toggleBtn = document.getElementById('toggleBtn');
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');

if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
        if (sidebar) sidebar.classList.toggle('active');
        if (sidebarOverlay) sidebarOverlay.classList.toggle('active');
    });
}

if (sidebarOverlay) {
    sidebarOverlay.addEventListener('click', () => {
        if (sidebar) sidebar.classList.remove('active');
        if (sidebarOverlay) sidebarOverlay.classList.remove('active');
    });
}

// Modal de Demandas Manuais
window.openDemandaModal = function() {
    const modalD = document.getElementById('demandaModal');
    if (modalD) modalD.style.display = 'flex';
};
window.closeDemandaModal = function() {
    const modalD = document.getElementById('demandaModal');
    if (modalD) modalD.style.display = 'none';
};

const formDem = document.getElementById('form-demanda');
if (formDem) {
    formDem.addEventListener('submit', async (e) => {
        e.preventDefault();
        await addDoc(colDemandas, {
            titulo: document.getElementById('dem-titulo').value,
            cliente: document.getElementById('dem-cliente-ref').value,
            etapa: 'Aguardando'
        });
        closeDemandaModal();
        e.target.reset();
    });
}

// Lógica de Limpeza do Histórico do Firestore
const btnLimparHistorico = document.getElementById('btn-limpar-historico-solicitacoes');
if (btnLimparHistorico) {
    btnLimparHistorico.onclick = async () => {
        const historico = appState.solicitacoes.filter(s => s.status !== 'Pendente');
        if (historico.length === 0) {
            await Alerta("Não há solicitações no histórico para limpar.", "Histórico Vazio", "info");
            return;
        }

        if (await Confirmar("Deseja realmente limpar de forma permanente todo o histórico de solicitações?", "Limpar Histórico", "danger")) {
            try {
                for (const sol of historico) {
                    await deleteDoc(doc(db, "solicitacoes", sol.id));
                }
                await Alerta("Histórico de solicitações limpo com sucesso!", "Limpeza Concluída", "success");
            } catch (error) {
                console.error("Erro ao limpar histórico: ", error);
                await Alerta("Erro técnico ao tentar limpar o histórico.", "Erro", "danger");
            }
        }
    };
}

// Vinculação de funções globais para que os eventos inline (onclick) do HTML funcionem
window.openDemandaModal = window.openDemandaModal;
window.closeDemandaModal = window.closeDemandaModal;
window.removerLinhaItem = window.removerLinhaItem;
window.adicionarLinhaItem = window.adicionarLinhaItem;
window.openCrmModal = window.openCrmModal;
window.closeCrmModal = window.closeCrmModal;