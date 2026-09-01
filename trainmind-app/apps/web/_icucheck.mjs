import { IntlMessageFormat } from 'intl-messageformat';
import fs from 'fs';
const keys=['ftDeleteEvent','ftDeleteEventConfirm','ftDeleteEventDetail','ftEventDeleted','ftEventDeleteError'];
let bad=0;
for(const l of ['it','en','es']){
  const d=JSON.parse(fs.readFileSync(process.argv[2]+'/'+l+'.json','utf8'));
  for(const k of keys){
    try{ console.log(l,k,'->',new IntlMessageFormat(d.calendar[k],l).format({name:'Test'})); }
    catch(e){bad++;console.log('ICU ERROR',l,k,e.message)}
  }
}
process.exit(bad?1:0);
