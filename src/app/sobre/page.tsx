import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Sobre e fontes — Portal NCM" };

export default function Sobre() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-10 sm:px-8">
      <Link href="/" className="text-sm text-muted hover:text-ink hover:underline">
        Voltar para a busca
      </Link>
      <h1 className="mt-8 font-display text-4xl font-semibold tracking-tight">Sobre o Portal NCM</h1>
      <div className="mt-6 space-y-5 leading-relaxed">
        <p>
          O Portal NCM ajuda microempreendedores e pequenos comerciantes a encontrar o código da Nomenclatura Comum do Mercosul de suas mercadorias, sem abrir planilhas extensas. É um projeto de extensão do curso de Análise e Desenvolvimento de Sistemas da UNINTER, voltado ao comércio de Sorocaba (SP).
        </p>
        <h2 className="pt-2 font-display text-xl font-semibold">De onde vêm os dados</h2>
        <p>
          A tabela de códigos, descrições e atos legais vem da Nomenclatura Comum do Mercosul vigente, conforme a Resolução Gecex nº 926/2026, publicada pelo governo federal.
        </p>
        <h2 className="pt-2 font-display text-xl font-semibold">Alíquotas</h2>
        <p>
          O IPI vem da TIPI, publicada pela Receita Federal, e o imposto de importação vem da Tarifa Externa Comum, publicada pelo MDIC nas resoluções da Gecex. Os dois são lidos dos arquivos oficiais, e exceções vigentes com cota ou prazo aparecem como observação. Onde a fonte não traz valor, o portal escreve “sem dado na fonte oficial”, o que não significa alíquota zero. Além deles, o portal mostra os tributos aproximados no preço, calculados pelo IBPT para a informação exigida na nota ao consumidor. ICMS, PIS e COFINS dependem do estado e do regime da empresa e não são exibidos.
        </p>
        <h2 className="pt-2 font-display text-xl font-semibold">Seus dados</h2>
        <p>
          Não há cadastro nem senha. Seus favoritos e buscas recentes ficam ligados a um identificador anônimo deste aparelho e guardados no banco do projeto. Limpar os dados do navegador desvincula esse histórico.
        </p>
        <p className="text-muted">Consulta informativa: confirme a classificação com seu contador.</p>
      </div>
    </div>
  );
}
