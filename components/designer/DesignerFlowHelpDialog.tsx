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

export function DesignerFlowHelpDialog() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="h-10 w-10"
          aria-label="ABRIR AJUDA DO FLUXO DO DESIGNER"
        >
          <HelpCircle className="h-4 w-4" />
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-4xl space-y-4">
        <DialogHeader>
          <DialogTitle>FLUXO DO DESIGNER — COMO FUNCIONA</DialogTitle>
        </DialogHeader>

        {/* 1. LISTA DE TRABALHOS */}
        <section className="space-y-1">
          <h2 className="text-sm">
            1. LISTA DE TRABALHOS (FO / FOLHAS DE OBRA)
          </h2>
          <p className="text-xs text-muted-foreground">
            ESTA PÁGINA MOSTRA TODAS AS FOLHAS DE OBRA (FO) QUE PRECISAM DE
            TRATAMENTO DE DESIGN: PROPOSTAS, ARTE FINAL, PAGINAÇÃO E PLANOS DE
            PRODUÇÃO.
          </p>
        </section>

        {/* 2. ATRIBUIR FO A UM DESIGNER */}
        <section className="space-y-1">
          <h2 className="text-sm">2. ATRIBUIR A FO A UM DESIGNER</h2>
          <p className="text-xs text-muted-foreground">
            EM CADA LINHA, USE O COMBOBOX PARA ESCOLHER O DESIGNER RESPONSÁVEL
            POR ESSA FOLHA DE OBRA. NENHUM TRABALHO DEVE AVANÇAR SEM TER UM
            DESIGNER ATRIBUÍDO.
          </p>
        </section>

        {/* 3. VER ITENS DA FO */}
        <section className="space-y-1">
          <h2 className="text-sm">3. VER OS ITENS (BOTÃO COM O OLHO)</h2>
          <p className="text-xs text-muted-foreground">
            CLIQUE NO BOTÃO COM O ÍCONE DO OLHO PARA ABRIR OS DETALHES DA FO. AÍ
            VÊ TODOS OS ITENS DESSA FOLHA: CADA ITEM REPRESENTA UM COMPONENTE /
            PEÇA DO TRABALHO QUE PRECISA DE DESIGN.
          </p>
        </section>

        {/* 4. PASSO 1 POR ITEM: CÓDIGO E COMPLEXIDADE */}
        <section className="space-y-1">
          <h2 className="text-sm">4. POR CADA ITEM: CÓDIGO E COMPLEXIDADE</h2>
          <ol className="text-xs text-muted-foreground space-y-0.5 list-decimal pl-4">
            <li>
              CÓDIGO: SE O ITEM TIVER CÓDIGO EM FALTA, PREENCHER O CÓDIGO
              CORRETO.
            </li>
            <li>
              COMPLEXIDADE: ESCOLHER A COMPLEXIDADE ADEQUADA (EX.: RICH,
              SPECIAL, NEW, OUTRAS OPÇÕES DISPONÍVEIS). CADA ITEM TEM DE TER UMA
              COMPLEXIDADE DEFINIDA. ESTE DADO É CRÍTICO PARA PLANEAMENTO E
              CUSTOS.
            </li>
          </ol>
        </section>

        {/* 5. PRIMEIRA PROPOSTA */}
        <section className="space-y-1">
          <h2 className="text-sm">5. PRIMEIRA PROPOSTA (M ENVIADA)</h2>
          <ol className="text-xs text-muted-foreground space-y-0.5 list-decimal pl-4">
            <li>CRIAR A PRIMEIRA PROPOSTA DE ARTE PARA O ITEM.</li>
            <li>ENVIAR POR EMAIL AO SOLICITANTE / CLIENTE.</li>
            <li>
              ASSIM QUE A PROPOSTA É ENVIADA, MARCAR O CHECKBOX &quot;M
              ENVIADA&quot; PARA REGISTAR QUE A VERSÃO FOI ENVIADA.
            </li>
          </ol>
        </section>

        {/* 6. RESPOSTA DO CLIENTE: APROVADA OU RECUSADA */}
        <section className="space-y-1">
          <h2 className="text-sm">6. RESPOSTA DO CLIENTE</h2>
          <p className="text-xs text-muted-foreground">
            QUANDO O CLIENTE RESPONDE À PROPOSTA:
          </p>
          <ul className="text-xs text-muted-foreground space-y-0.5 list-disc pl-4">
            <li>
              SE FOR APROVADA: MARCAR &quot;A RECEBIDA&quot; (APROVAÇÃO
              RECEBIDA). ESTE ITEM ESTÁ PRONTO PARA PAGINAÇÃO.
            </li>
            <li>
              SE FOR RECUSADA: MARCAR O CHECKBOX DE RECUSA DA VERSÃO (EX.: R1
              RECUSADA) E PREPARAR UMA NOVA VERSÃO.
            </li>
          </ul>
        </section>

        {/* 7. PAGINAÇÃO APÓS APROVAÇÃO */}
        <section className="space-y-1">
          <h2 className="text-sm">7. PAGINAÇÃO (APÓS APROVAÇÃO)</h2>
          <ol className="text-xs text-muted-foreground space-y-0.5 list-decimal pl-4">
            <li>
              QUANDO &quot;A RECEBIDA&quot; ESTÁ MARCADO, FICA DISPONÍVEL O
              ESTADO DE &quot;PAGINAÇÃO&quot; PARA ESSE ITEM.
            </li>
            <li>
              O DESIGNER PREPARA A ARTE FINAL / PAGINAÇÃO DEFINITIVA PARA
              PRODUÇÃO.
            </li>
            <li>
              PREENCHER O CAMPO COM O PATH / LOCALIZAÇÃO (PET) ONDE A ARTE FINAL
              ESTÁ GUARDADA.
            </li>
          </ol>
        </section>

        {/* 8. PLANOS DE PRODUÇÃO */}
        <section className="space-y-1">
          <h2 className="text-sm">8. PLANOS DE PRODUÇÃO (ADICIONAR PLANO)</h2>
          <ol className="text-xs text-muted-foreground space-y-0.5 list-decimal pl-4">
            <li>
              CLICAR EM &quot;ADICIONAR PLANO&quot; PARA CRIAR UM PLANO DE
              PRODUÇÃO. O SISTEMA ATRIBUI UM NOME (PLANO A, B, C...).
            </li>
            <li>OPCIONALMENTE, AJUSTAR O NOME DO PLANO SE NECESSÁRIO.</li>
            <li>
              ESCOLHER O TIPO DE TRABALHO (EX.: CARTÃO, IMPRESSÃO, FLEXÍVEIS,
              OUTROS DISPONÍVEIS).
            </li>
            <li>
              DEFINIR A MÁQUINA ONDE O PLANO ESTÁ PREVISTO SER PRODUZIDO (A
              PRODUÇÃO PODE ALTERAR MAIS TARDE, MAS O DESIGNER DEVE PLANEÁ-LA).
            </li>
            <li>
              ESCOLHER O MATERIAL, O NÚMERO DE CORES E A QUANTIDADE ASSOCIADA A
              ESSE PLANO.
            </li>
            <li>
              EXEMPLO: SE O TOTAL É 300 UNIDADES E CADA PLANO PRODUZ 30, ENTÃO
              DEFINIR 10 REPETIÇÕES / FOLHAS NO PLANO.
            </li>
          </ol>
        </section>

        {/* 9. GESTÃO DE VERSÕES (SE RECUSado) */}
        <section className="space-y-1">
          <h2 className="text-sm">9. GESTÃO DE VERSÕES QUANDO HÁ RECUSA</h2>
          <ol className="text-xs text-muted-foreground space-y-0.5 list-decimal pl-4">
            <li>
              SE A VERSÃO 1 FOR RECUSADA, MARCAR O CHECKBOX DE RECUSA (R1 /
              RECUSADA).
            </li>
            <li>
              CRIAR UMA NOVA VERSÃO DE ARTE E ENVIAR NOVAMENTE (VERSÃO 2
              ENVIADA) E MARCAR O ESTADO CORRESPONDENTE.
            </li>
            <li>
              SE A VERSÃO 2 FOR APROVADA, MARCAR &quot;A RECEBIDA&quot; E SEGUIR
              PARA PAGINAÇÃO + PLANOS.
            </li>
            <li>
              SE VOLTAR A SER RECUSADA, REPETIR O PROCESSO: R2 RECUSADA → VERSÃO
              3 ENVIADA → ATÉ HAVER UMA APROVAÇÃO.
            </li>
          </ol>
        </section>

        {/* 10. OBJETIVO FINAL */}
        <section className="space-y-1">
          <h2 className="text-sm">10. OBJETIVO FINAL DO FLUXO DO DESIGNER</h2>
          <p className="text-xs text-muted-foreground">
            CADA ITEM APROVADO DEVE TERMINAR COM: DESIGNER ATRIBUÍDO, CÓDIGO
            DEFINIDO, COMPLEXIDADE REGISTADA, HISTÓRICO DE PROPOSTAS
            CORRETAMENTE MARCADO, PAGINAÇÃO CONCLUÍDA, PATH DA ARTE FINAL
            PREENCHIDO E PLANOS DE PRODUÇÃO COMPLETOS (TIPO, MÁQUINA, MATERIAL,
            CORES E QUANTIDADES). ASSIM, A PRODUÇÃO CONSEGUE EXECUTAR SEM
            DÚVIDAS NEM RETRABALHO.
          </p>
        </section>
      </DialogContent>
    </Dialog>
  );
}







