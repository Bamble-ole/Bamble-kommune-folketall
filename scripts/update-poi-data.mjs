import { readFileSync, writeFileSync } from 'fs';

const ADMIN_FILTER = ['Fellestjenester', 'Paletten'];

// ── SKOLER: oppdater antallAnsatte + koordinater, fjern admin-enheter ─────────
const oldSkoler = JSON.parse(readFileSync('public/data/skoler.geojson', 'utf8'));
const newSkoler = JSON.parse(readFileSync(
  'c:/Users/05olsolek/Desktop/Web/Bamble/data/Barnehage_skole/Nedlastingspakke/Befolkning_4012_Bamble_25833_Grunnskoler_GML.geojson', 'utf8'
));

const newSkolerMap = new Map(newSkoler.features.map(f => [f.properties.skolenavn, f]));

const mergedSkoler = {
  ...oldSkoler,
  features: oldSkoler.features
    .filter(f => !ADMIN_FILTER.some(a => f.properties.skolenavn.includes(a)))
    .map(f => {
      const newF = newSkolerMap.get(f.properties.skolenavn);
      if (!newF) return f;
      return {
        ...f,
        geometry: newF.geometry,
        properties: {
          ...f.properties,
          antallAnsatte: newF.properties.antallAnsatte,
          oppdateringsdato: newF.properties.oppdateringsdato,
        },
      };
    }),
};

writeFileSync('public/data/skoler.geojson', JSON.stringify(mergedSkoler, null, 2));
console.log('Skoler oppdatert:', mergedSkoler.features.length, 'stk');
mergedSkoler.features.forEach(f =>
  console.log(` - ${f.properties.skolenavn} | elever: ${f.properties.antallElever} | ansatte: ${f.properties.antallAnsatte}`)
);

// ── BARNEHAGER: oppdater tall, behold adresser ────────────────────────────────
const oldBarn = JSON.parse(readFileSync('public/data/barnehager.geojson', 'utf8'));
const newBarn = JSON.parse(readFileSync(
  'c:/Users/05olsolek/Desktop/Web/Bamble/data/Barnehage_skole/Nedlastingspakke/Befolkning_4012_Bamble_25833_Barnehager_GML.geojson', 'utf8'
));

const newBarnMap = new Map(newBarn.features.map(f => [f.properties.barnehagenavn, f]));

const mergedBarn = {
  ...oldBarn,
  features: oldBarn.features.map(f => {
    const newF = newBarnMap.get(f.properties.barnehagenavn);
    if (!newF) return f;
    return {
      ...f,
      geometry: newF.geometry,
      properties: {
        ...f.properties,
        antallBarn:    newF.properties.antallBarn,
        antallAnsatte: newF.properties.antallAnsatte,
        høyesteAlder:  newF.properties.høyesteAlder,
        lavesteAlder:  newF.properties.lavesteAlder,
        åpningstidFra: newF.properties.åpningstidFra,
        åpningstidTil: newF.properties.åpningstidTil,
        eierforhold:   newF.properties.eierforhold,
        datauttaksdato: newF.properties.datauttaksdato,
      },
    };
  }),
};

writeFileSync('public/data/barnehager.geojson', JSON.stringify(mergedBarn, null, 2));
console.log('\nBarnehager oppdatert:', mergedBarn.features.length, 'stk');
mergedBarn.features.forEach(f =>
  console.log(` - ${f.properties.barnehagenavn} | barn: ${f.properties.antallBarn} | ansatte: ${f.properties.antallAnsatte}`)
);
