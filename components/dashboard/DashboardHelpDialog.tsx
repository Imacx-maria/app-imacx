"use client";

import { useState } from "react";
import { HelpCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function DashboardHelpDialog() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="h-10 w-10"
          aria-label="ABRIR AJUDA DO DASHBOARD"
        >
          <HelpCircle className="h-4 w-4" />
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-3xl space-y-4">
        <DialogHeader>
          <DialogTitle>DASHBOARD DE LOGÍSTICA — COMO FUNCIONA</DialogTitle>
        </DialogHeader>

        {/* 1. O QUE É ESTE PAINEL */}
        <section className="space-y-1">
          <h2 className="text-sm">1. O QUE É ESTE PAINEL?</h2>
          <p className="text-xs text-muted-foreground">
            ESTE ECRÃ MOSTRA TODOS OS ITENS DAS FOLHAS DE OBRA (FO) QUE PRECISAM
            DE TRATAMENTO LOGÍSTICO: TRABALHOS CONCLUÍDOS PELA PRODUÇÃO E COM
            DATA DE SAÍDA DEFINIDA OU A DEFINIR.
          </p>
        </section>

        {/* 2. CALENDÁRIO */}
        <section className="space-y-1">
          <h2 className="text-sm">2. CALENDÁRIO NO TOPO</h2>
          <ul className="text-xs text-muted-foreground space-y-0.5 list-disc pl-4">
            <li>
              CLICAR NUM DIA FILTRA A TABELA PARA OS TRABALHOS QUE SAEM NESSE
              DIA.
            </li>
            <li>
              MOSTRA SEMPRE OS TRABALHOS QUE TÊM SAÍDA PLANEADA NO DIA
              SELECIONADO.
            </li>
          </ul>
        </section>

        {/* 3. FILTROS RÁPIDOS */}
        <section className="space-y-1">
          <h2 className="text-sm">3. FILTROS RÁPIDOS</h2>
          <p className="text-xs text-muted-foreground">
            USE OS CAMPOS POR CIMA DA TABELA PARA FILTRAR POR FO, ORC
            (ORÇAMENTO), Nº GUIA, CLIENTE, CAMPANHA E ITEM. PODE COMBINAR VÁRIOS
            FILTROS PARA ENCONTRAR RAPIDAMENTE O TRABALHO CERTO.
          </p>
        </section>

        {/* 4. ALL VS TODAY */}
        <section className="space-y-1">
          <h2 className="text-sm">4. ALL VS TODAY</h2>
          <ul className="text-xs text-muted-foreground space-y-0.5 list-disc pl-4">
            <li>ALL: MOSTRA TODOS OS TRABALHOS.</li>
            <li>
              TODAY: MOSTRA APENAS OS TRABALHOS COM SAÍDA NA DATA DE HOJE.
            </li>
          </ul>
        </section>

        {/* 5. ORDENAÇÃO */}
        <section className="space-y-1">
          <h2 className="text-sm">5. ORDENAÇÃO DA TABELA</h2>
          <p className="text-xs text-muted-foreground">
            CLIQUE EM QUALQUER CABEÇALHO (CLIENTE, CAMPANHA, ITEM, ESTADO, ETC.)
            PARA ORDENAR E ORGANIZAR PRIORIDADES.
          </p>
        </section>

        {/* 6. TAREFAS DO GESTOR DE LOGÍSTICA */}
        <section className="space-y-1">
          <h2 className="text-sm">
            6. O QUE O GESTOR DE LOGÍSTICA TEM DE FAZER
          </h2>
          <ol className="text-xs text-muted-foreground space-y-0.5 list-decimal pl-4">
            <li>
              CONFIRMAR QUE O ITEM ESTÁ CONCLUÍDO PELA PRODUÇÃO E QUE EXISTE UMA
              DATA DE SAÍDA (PLANEADA).
            </li>
            <li>
              INSERIR O NÚMERO DA GUIA DE TRANSPORTE E VERIFICAR SE A QUANTIDADE
              ESTÁ CORRETA.
            </li>
            <li>
              ABRIR O ÍCONE DE TRANSPORTE / TRACKING PARA CONFIRMAR ORIGEM,
              DESTINO E TRANSPORTADORA E AJUSTAR SE NECESSÁRIO.
            </li>
            <li>
              OPCIONAL: PREENCHER PESO, NÚMERO DE VIATURAS E NÚMERO DE PALETES,
              QUANDO RELEVANTE PARA O PLANEAMENTO.
            </li>
            <li>
              SE O TRABALHO FOR CONCLUÍDO NUM DIA MAS SÓ SAIR NOUTRO, AJUSTAR A
              DATA DE SAÍDA NO SELETOR DE DATA PARA O DIA REAL EM QUE VAI SAIR.
            </li>
          </ol>
        </section>

        {/* 7. MARCAR COMO DESPACHADO */}
        <section className="space-y-1">
          <h2 className="text-sm">
            7. QUANDO MARCAR &ldquo;S&rdquo; (DESPACHADO)
          </h2>
          <p className="text-xs text-muted-foreground">
            QUANDO O TRABALHO SAI EFETIVAMENTE E ESTÁ CONFIRMADO, MARCAR O
            CHECKBOX &ldquo;S&rdquo;. O ITEM É MOVIDO PARA O SEPARADOR
            &ldquo;DESPACHADOS&rdquo;, MANTENDO O DASHBOARD APENAS COM OS
            TRABALHOS AINDA POR SAIR.
          </p>
        </section>

        {/* 8. RESUMO RÁPIDO */}
        <section className="space-y-1">
          <h2 className="text-sm">8. RESUMO RÁPIDO</h2>
          <p className="text-xs text-muted-foreground">
            PRODUÇÃO CONCLUI → ITEM APARECE NO DASHBOARD → LOGÍSTICA CONFERE
            DADOS, INSERE GUIA, AJUSTA DATA E TRANSPORTE → QUANDO SAI, MARCA
            &ldquo;S&rdquo; → ITEM VAI PARA &ldquo;DESPACHADOS&rdquo;.
          </p>
        </section>
      </DialogContent>
    </Dialog>
  );
}
