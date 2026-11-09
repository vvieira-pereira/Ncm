import { describe, expect, it } from "vitest";
import { cleanDescription, parseNcm, type RawNcm } from "../src/lib/ncm-parse";

const mk = (Codigo: string, Descricao: string): RawNcm => ({
  Codigo,
  Descricao,
  Data_Inicio: "01/04/2022",
  Data_Fim: "31/12/9999",
  Tipo_Ato_Ini: "Res Gecex",
  Numero_Ato_Ini: "272",
  Ano_Ato_Ini: "2021",
});

describe("cleanDescription", () => {
  it("remove hifens iniciais e tags html", () => {
    expect(cleanDescription("-- Outros")).toBe("Outros");
    expect(cleanDescription("Aves <i>Gallus</i> vivas")).toBe("Aves Gallus vivas");
  });
});

describe("parseNcm", () => {
  const rows = parseNcm([
    mk("01", "Animais vivos."),
    mk("01.01", "Cavalos."),
    mk("0101.2", "- Cavalos:"),
    mk("0101.21.00", "-- Reprodutores"),
    mk("0101.90.00", "- Outros"),
  ]);
  const by = Object.fromEntries(rows.map((r) => [r.codigo, r]));

  it("liga cada codigo ao pai pelo maior prefixo existente", () => {
    expect(by["01"].pai).toBeNull();
    expect(by["01.01"].pai).toBe("01");
    expect(by["0101.2"].pai).toBe("01.01");
    expect(by["0101.21.00"].pai).toBe("0101.2");
    expect(by["0101.90.00"].pai).toBe("01.01");
  });
  it("define nivel e datas", () => {
    expect(by["01"].nivel).toBe(0);
    expect(by["01.01"].nivel).toBe(1);
    expect(by["0101.21.00"].nivel).toBe(2);
    expect(by["01"].dataFim).toBeNull();
    expect(by["01"].dataInicio).toBe("2022-04-01");
    expect(by["01"].ato).toBe("Res Gecex 272/2021");
  });
});
