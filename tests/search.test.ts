import { describe, expect, it } from "vitest";
import { createEngine, normalize, type IndexFile } from "../src/lib/search";

const data: IndexFile = {
  atualizacao: "Vigente em 09/11/2026",
  atos: ["Res Gecex 272/2021"],
  itens: [
    ["01", "Animais vivos.", -1, 0, "2022-04-01"],
    ["01.01", "Cavalos, asininos e muares, vivos.", 0, 0, "2022-04-01"],
    ["0101.2", "Cavalos:", 1, 0, "2022-04-01"],
    ["0101.21.00", "Reprodutores de raça pura", 2, 0, "2022-04-01"],
    ["0101.29.00", "Outros", 2, 0, "2022-04-01"],
    ["0101.90.00", "Outros", 1, 0, "2022-04-01"],
    ["02", "Carnes e miudezas, comestíveis.", -1, 0, "2022-04-01"],
  ],
};
const e = createEngine(data);

describe("normalize", () => {
  it("remove acentos, caixa e pontuação", () => {
    expect(normalize("Raça-Pura, ÓTIMO")).toBe("raca pura otimo");
  });
});

describe("busca por codigo", () => {
  it("aceita prefixo com ou sem pontos", () => {
    expect(e.search("0101.2").map((i) => i.codigo)).toEqual(["0101.2", "0101.21.00", "0101.29.00"]);
    expect(e.search("010121").map((i) => i.codigo)).toEqual(["0101.21.00"]);
  });
  it("codigo exato vem primeiro", () => {
    expect(e.search("01")[0].codigo).toBe("01");
  });
});

describe("busca por texto", () => {
  it("ignora acentos e exige todos os termos", () => {
    expect(e.search("raca pura")[0].codigo).toBe("0101.21.00");
    expect(e.search("raca carnes")).toEqual([]);
  });
  it("encontra 'Outros' pelo contexto dos ancestrais", () => {
    const r = e.search("cavalos outros").map((i) => i.codigo);
    expect(r).toContain("0101.29.00");
    expect(r).toContain("0101.90.00");
  });
  it("devolve vazio para consulta vazia", () => {
    expect(e.search("   ")).toEqual([]);
  });
});

describe("hierarquia", () => {
  it("monta ancestrais e filhos", () => {
    const id = e.byCode.get("0101.21.00")!;
    expect(e.ancestors(id).map((i) => i.codigo)).toEqual(["01", "01.01", "0101.2"]);
    expect(e.children(e.byCode.get("0101.2")!).map((i) => i.codigo)).toEqual(["0101.21.00", "0101.29.00"]);
  });
});

describe("desempenho", () => {
  it("busca em ~15 mil itens abaixo de 30 ms", () => {
    const big: IndexFile = { atualizacao: "", atos: ["x"], itens: [] };
    for (let n = 0; n < 15000; n++) {
      big.itens.push([String(n).padStart(8, "0"), `Produto numero ${n} de plastico`, -1, 0, "2022-04-01"]);
    }
    const be = createEngine(big);
    const t0 = performance.now();
    be.search("plastico 77");
    expect(performance.now() - t0).toBeLessThan(30);
  });
});
