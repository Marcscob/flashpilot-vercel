import {test,expect} from "bun:test";import {splitLegalText} from "../src/lib/legal-hierarchy";
test("x",()=>{const r=splitLegalText(`DECRETO Nº 9.739, DE 16 DE MARÇO DE 2019
Estabelece medidas de eficiência organizacional para o aprimoramento da administração pública federal, e dá outras providências.
O PRESIDENTE DA REPÚBLICA, no uso da atribuição que lhe confere o art. 84,
DECRETA:
Art. 1º Este Decreto estabelece.
Art. 2º Para fins.
Art. 3º Fica.`);console.log(r);expect(r!.subject.startsWith("Estabelece medidas")).toBe(true);expect(r!.units[0]!.topic).not.toMatch(/Decreta/i)});
import {isGenericName} from "../src/lib/destination-names";
test("enacting formula is never a name",()=>{expect(isGenericName("Decreta:")).toBe(true);expect(isGenericName("Resolve")).toBe(true);});
test("CLT ementa names the approved norm",()=>{const r=splitLegalText(`DECRETO-LEI Nº 5.452, DE 1º DE MAIO DE 1943
Aprova a Consolidação das Leis do Trabalho.
O PRESIDENTE DA REPÚBLICA, usando da atribuição,
DECRETA:
Art. 1º Fica aprovada a Consolidação.
Art. 2º Este decreto-lei entrará em vigor.
CONSOLIDAÇÃO DAS LEIS DO TRABALHO
TÍTULO I
INTRODUÇÃO
Art. 1º Esta Consolidação estatui.`);expect(r!.subject).toBe("Consolidação das Leis do Trabalho");expect(r!.units.map(u=>u.topic)).not.toContain("Decreta:");});
