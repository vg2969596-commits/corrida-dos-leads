// --- CONFIGURAÇÃO DEFINITIVA DO SUPABASE (CORRIDA DOS LEADS) ---
const SUPABASE_URL = "https://wpawajkguxvofpexhufn.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_4uAvBCGWXgPG_lyfyWeP0g_OyIivucf";

// Inicializa o cliente do Supabase
const supabaseClient = window.supabase
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

let metaMensalIndividual = 100;
let recepcionistas = [];
let isAdminView = false;

// Proteção simples de acesso ao Painel Admin (não substitui RLS no Supabase)
// Guardamos apenas o hash SHA-256 da senha, nunca a senha em texto puro.
const SENHA_ADMIN_HASH =
  "6657dfd5a5d0425e3b3246e08a39222d3c4a27e0067fb57a434829a172ea0f74";

async function calcularHash(texto) {
  const dados = new TextEncoder().encode(texto);
  const bufferHash = await crypto.subtle.digest("SHA-256", dados);
  return Array.from(new Uint8Array(bufferHash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// 1. CARREGAR DADOS DO BANCO
async function carregarDadosDoBanco() {
  if (!supabaseClient) {
    console.error("Erro crítico: Cliente Supabase não carregou.");
    return;
  }

  try {
    console.log("Buscando dados do Supabase...");

    // Busca configurações
    const { data: configData, error: configError } = await supabaseClient
      .from("configuracoes")
      .select("meta_mensal")
      .limit(1)
      .single();

    if (configError) {
      console.warn("Aviso na tabela configuracoes:", configError.message);
    } else if (configData) {
      metaMensalIndividual = configData.meta_mensal;
    }

    // Busca recepcionistas
    const { data: recData, error: recError } = await supabaseClient
      .from("recepcionistas")
      .select("*")
      .eq("ativo", true);

    if (recError) {
      console.error("Erro ao buscar recepcionistas:", recError.message);
    } else if (recData) {
      recepcionistas = recData;
      console.log("Recepcionistas carregados com sucesso:", recepcionistas);
    }

    renderApp();
  } catch (err) {
    console.error("Erro inesperado na conexão com o Supabase:", err);
  }
}

// 2. ALTERNAR TELAS
async function toggleView() {
  if (!isAdminView && !sessionStorage.getItem("adminAutenticado")) {
    const senhaDigitada = prompt("Digite a senha do Painel Admin:");
    if (senhaDigitada === null) return;
    const hashDigitado = await calcularHash(senhaDigitada);
    if (hashDigitado !== SENHA_ADMIN_HASH) {
      alert("Senha incorreta!");
      return;
    }
    sessionStorage.setItem("adminAutenticado", "true");
  }

  isAdminView = !isAdminView;
  const rankView = document.getElementById("view-ranking");
  const adminView = document.getElementById("view-admin");
  const btn = document.getElementById("btn-switch-view");

  if (!rankView || !adminView || !btn) return;

  if (isAdminView) {
    rankView.classList.remove("active");
    adminView.classList.add("active");
    btn.innerText = "🏆 Ver Pista";
    renderAdminPanel();
  } else {
    adminView.classList.remove("active");
    rankView.classList.add("active");
    btn.innerText = "⚙️ Painel Admin";
    carregarDadosDoBanco();
  }
}

// 3. RENDERIZAR TELA PRINCIPAL (PISTA E PÓDIO)
function renderApp() {
  if (!recepcionistas) return;

  recepcionistas.sort((a, b) => b.leads_mes - a.leads_mes);

  const podiumEl = document.getElementById("podium");
  if (podiumEl) {
    podiumEl.innerHTML = "";
    const posClasses = ["second", "first", "third"];
    const podiumOrder = [
      recepcionistas[1],
      recepcionistas[0],
      recepcionistas[2],
    ];

    podiumOrder.forEach((rec, index) => {
      if (!rec) return;
      const realPos = index === 1 ? 1 : index === 0 ? 2 : 3;
      const medal = realPos === 1 ? "🥇" : realPos === 2 ? "🥈" : "🥉";

      const card = document.createElement("div");
      card.className = `podium-card ${posClasses[index]}`;
      card.innerHTML = `
        <div class="podium-medal">${medal}</div>
        <div class="podium-name">${rec.nome}</div>
        <div class="podium-score">${rec.leads_mes} leads</div>
      `;
      podiumEl.appendChild(card);
    });
  }

  const listEl = document.getElementById("ranking-list");
  if (listEl) {
    listEl.innerHTML = "";
    recepcionistas.forEach((rec, index) => {
      const percentual = Math.min(
        Math.round((rec.leads_mes / metaMensalIndividual) * 100),
        100,
      );
      const row = document.createElement("div");
      row.className = "runner-row";
      row.innerHTML = `
        <div class="runner-info">
            <span>#${index + 1} - ${rec.nome}</span>
            <span>${rec.leads_mes} leads</span>
        </div>
        <div class="track">
            <div class="horse-bar" style="width: ${percentual}%;" data-tooltip="${rec.leads_mes} de ${metaMensalIndividual} leads (${percentual}%)"></div>
        </div>
      `;
      listEl.appendChild(row);
    });
  }

  const totalSomaLeads = recepcionistas.reduce(
    (acc, curr) => acc + curr.leads_mes,
    0,
  );
  const metaGlobalEquipe = metaMensalIndividual * recepcionistas.length;
  const percentualGlobal =
    metaGlobalEquipe > 0
      ? Math.min(Math.round((totalSomaLeads / metaGlobalEquipe) * 100), 100)
      : 0;

  const statsEl = document.getElementById("global-stats");
  const barEl = document.getElementById("global-bar");

  if (statsEl)
    statsEl.innerText = `${totalSomaLeads} / ${metaGlobalEquipe} leads (${percentualGlobal}%)`;
  if (barEl) barEl.style.width = `${percentualGlobal}%`;
}

// 4. RENDERIZAR PAINEL ADMIN
function renderAdminPanel() {
  const metaInput = document.getElementById("input-meta-individual");
  if (metaInput) metaInput.value = metaMensalIndividual;

  const lancContainer = document.getElementById("lancamento-inputs");
  if (lancContainer) {
    lancContainer.innerHTML = "";
    recepcionistas.forEach((rec, idx) => {
      lancContainer.innerHTML += `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="font-weight: 600; color: #fff;">${rec.nome} (Atual: ${rec.leads_mes})</span>
            <input type="number" id="add-lead-${idx}" class="form-control" style="width: 100px;" placeholder="+ leads" value="0">
        </div>
      `;
    });
  }

  const gestaoContainer = document.getElementById("lista-gerenciamento");
  if (gestaoContainer) {
    gestaoContainer.innerHTML = "";
    recepcionistas.forEach((rec) => {
      gestaoContainer.innerHTML += `
        <div class="team-manage-row" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="color: #fff;">${rec.nome}</span>
            <button class="btn-toggle" style="color: #ef4444; border-color: #ef4444; background: transparent; padding: 4px 8px; border-radius: 6px; cursor: pointer;" onclick="removerRecepcionista(${rec.id})">Remover</button>
        </div>
      `;
    });
  }
}

// 5. SALVAR / ATUALIZAR META
async function atualizarMeta() {
  const metaInput = document.getElementById("input-meta-individual");
  if (!metaInput || !supabaseClient) return;

  const novaMeta = parseInt(metaInput.value);
  if (novaMeta > 0) {
    const { error } = await supabaseClient
      .from("configuracoes")
      .update({ meta_mensal: novaMeta })
      .eq("id", 1);

    if (!error) {
      metaMensalIndividual = novaMeta;
      alert("Meta atualizada na nuvem com sucesso!");
      toggleView();
    } else {
      alert("Erro ao atualizar meta: " + error.message);
    }
  }
}

// 6. SALVAR LANÇAMENTOS DE LEADS
async function salvarLancamentos() {
  if (!supabaseClient) return;

  for (let idx = 0; idx < recepcionistas.length; idx++) {
    const rec = recepcionistas[idx];
    const inputEl = document.getElementById(`add-lead-${idx}`);
    const addVal = inputEl ? parseInt(inputEl.value) || 0 : 0;

    if (addVal !== 0) {
      const novoTotal = rec.leads_mes + addVal;
      const { error } = await supabaseClient
        .from("recepcionistas")
        .update({ leads_mes: novoTotal })
        .eq("id", rec.id);

      if (error) {
        alert("Erro ao salvar leads para " + rec.nome + ": " + error.message);
        return;
      }

      // Registra no log central do ecossistema (tabela `eventos`), para
      // consolidar os resultados de todos os projetos em um único lugar
      // (hub / planilha do Google Sheets sincronizada).
      await supabaseClient.from("eventos").insert([
        {
          projeto: "corrida-dos-leads",
          tipo: "lead_lancado",
          quantidade: addVal,
          responsavel: rec.nome,
        },
      ]);
    }
  }
  alert("Leads lançados e salvos na nuvem!");
  toggleView();
}

// 7. ADICIONAR FUNCIONÁRIO
async function adicionarRecepcionista() {
  const nomeInput = document.getElementById("novo-nome");
  if (!nomeInput || !supabaseClient) return;

  const nome = nomeInput.value.trim();
  if (!nome) {
    alert("Digite o nome do recepcionista!");
    return;
  }

  const { error } = await supabaseClient
    .from("recepcionistas")
    .insert([{ nome: nome, leads_mes: 0, ativo: true }]);

  if (error) {
    alert("Erro ao adicionar no banco: " + error.message);
  } else {
    nomeInput.value = "";
    await carregarDadosDoBanco();
    renderAdminPanel();
    alert("Recepcionista adicionado com sucesso!");
  }
}

// 8. REMOVER FUNCIONÁRIO
async function removerRecepcionista(id) {
  if (!supabaseClient) return;

  const { error } = await supabaseClient
    .from("recepcionistas")
    .update({ ativo: false })
    .eq("id", id);

  if (!error) {
    await carregarDadosDoBanco();
    renderAdminPanel();
  } else {
    alert("Erro ao remover: " + error.message);
  }
}

// 9. EXPORTAR PDF
function exportarPDF() {
  if (!window.jspdf) return;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  const dataInicio =
    document.getElementById("data-inicio")?.value || "Início do Mês";
  const dataFim = document.getElementById("data-fim")?.value || "Hoje";

  doc.setFillColor(7, 13, 27);
  doc.rect(0, 0, 210, 40, "F");

  doc.setTextColor(245, 158, 11);
  doc.setFontSize(16);
  doc.text("CORRIDA DOS LEADS — SENTINELAS DO INFINITO", 14, 20);

  doc.setTextColor(200, 200, 200);
  doc.setFontSize(10);
  doc.text(`Período do Relatório: ${dataInicio} até ${dataFim}`, 14, 30);

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(12);
  doc.text("Ranking Final e Desempenho da Equipe:", 14, 55);

  let y = 65;
  recepcionistas.forEach((rec, index) => {
    doc.text(
      `${index + 1}º - ${rec.nome}: ${rec.leads_mes} leads (Meta: ${metaMensalIndividual})`,
      14,
      y,
    );
    y += 10;
  });

  doc.save(`ranking-leads-${dataInicio}-a-${dataFim}.pdf`);
}

// Inicialização automática
carregarDadosDoBanco();
