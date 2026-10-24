import test from "node:test";
import assert from "node:assert/strict";
import { normalizeLogin, accountAlias, normalizeDisplayName, parseRoster } from "../src/users.mjs";

test("matrículas de formatos distintos têm aliases individuais", () => {
 assert.equal(normalizeLogin(" n5923221 "), "N5923221");
 assert.equal(accountAlias("F106663"), "f106663@users.central-cop.invalid");
 assert.equal(accountAlias("LGCARVA"), "lgcarva@users.central-cop.invalid");
 assert.notEqual(accountAlias("N5923221"), accountAlias("N5923222"));
});
test("suporta colagem de tabela Markdown com cabeçalho", () => {
 const src = "| LOGIN | NOME |\n| --- | --- |\n| N5923221 | Pessoa Teste A |\n| F101864 | Pessoa Teste B |";
 const { data, errors } = parseRoster(src);
 assert.equal(errors.length, 0);
 assert.equal(data.length, 2);
 assert.deepEqual(data.map(x => x.login), ["N5923221","F101864"]);
});
test("colagens CSV e TSV são aceitas e espaços duplicados removidos", () => {
 const semicolon = parseRoster("LOGIN;NOME\nN5000001;Teste  Nome");
 assert.equal(semicolon.data[0].nome, "Teste Nome");
 const tabs = parseRoster("LOGIN\tNOME\nN5000002\tOutra Pessoa");
 assert.equal(tabs.data.length,1);
 assert.equal(normalizeDisplayName("  Ana  Teste  "), "Ana Teste");
});
test("duplicidade e matrícula inválida bloqueadas", () => {
 const { data, errors } = parseRoster("LOGIN;NOME\nN5000001;Pessoa Um\nn5000001;Pessoa Dois\nX?123;Pessoa Três");
 assert.equal(data.length, 1);
 assert.equal(errors.length, 2);
 assert.match(errors[0].message, /repetida/);
 assert.match(errors[1].message, /inválida/);
});
test("58 matrículas sintéticas válidas não são omitidas", () => {
 const names = Array.from({length:58}, (_,i)=>"N"+String(i+1).padStart(7,'0')+";Pessoa "+(i+1));
 const parsed = parseRoster("LOGIN;NOME\n"+names.join("\n"));
 assert.equal(parsed.errors.length,0);
 assert.equal(parsed.data.length,58);
});
