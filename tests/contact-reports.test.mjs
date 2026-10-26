import test from 'node:test';
import assert from 'node:assert/strict';
import {reportDialog,reviewDialog,reportsPage} from '../src/contact-reports.mjs';
test('relatos e respostas escapam HTML e preservam o contexto sem expor ações de admin a leitores',()=>{
 const report={id:'synthetic',contact_name:'<img src=x onerror=alert(1)>',contact_cluster:'RJ',reporter_id:'viewer',reason:'other',message:'<script>alert(1)</script>',status:'open',created_at:'2026-10-26T12:00:00Z'};
 const user=reportsPage({reports:[report]});assert.doesNotMatch(user,/<script>|<img src=x/);assert.match(user,/&lt;script&gt;/);assert.doesNotMatch(user,/data-action="report-review"/);
 assert.match(reportsPage({reports:[report],admin:true}),/data-action="report-review"/);
 const form=reportDialog({id:'synthetic',full_name:'Teste',cluster:'RJ'},{message:'</textarea><script>bad</script>'});assert.match(form,/&lt;\/textarea&gt;/);assert.doesNotMatch(form,/<script>/);assert.match(form,/maxlength="2000"/);
 assert.match(reviewDialog(report),/maxlength="1000"/);
 const resolved=reportsPage({reports:[{...report,status:'resolved',review_note:'Conferido.'}],filter:'resolved'});assert.match(resolved,/Conferido/);assert.doesNotMatch(resolved,/data-action="report-review"/);
});
