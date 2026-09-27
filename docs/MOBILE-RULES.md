# Regole telefono — il controllo obbligatorio (APP-1i)

Da APP-1i ogni pagina di PrevAI deve passare il **controllo telefono** a 360 px
(Android piccolo), 390 px (iPhone) e 430 px (iPhone Pro Max). È il seguito delle
fasi APP-1…APP-1h: lo stile resta quello della dashboard, le regole dicono solo
cosa un telefono non deve mai mostrare.

```bash
pnpm --filter @workspace/api-server qa:phone            # 360/390/430, esce con 1 se una pagina non passa
pnpm --filter @workspace/api-server qa:phone-sheets     # fogli di confronto: prime 3 schermate per larghezza
```

Il rapporto è in `artifacts/api-server/.qa/phone/report.md` (sezione *Phone rules*),
i fogli in `.qa/phone-sheets/phone/` (apri `index.html`, anche dal telefono).
Per un prima/dopo: `qa:phone -- --out=prima` sul codice di prima, poi
`qa:phone-sheets -- --baseline=prima`. Da una seconda chat che ha già
`qa:visual` acceso: `E2E_NO_PURGE=1 … qa:phone -- --port=5195 --out=phone-b`.
Anche `qa:visual` (le cinque larghezze) applica le stesse regole a 640 e 375 px.

## Le regole

| regola | cosa trova | come si sistema |
|---|---|---|
| sborda (overflow) | la pagina scorre di lato | la colonna larga va a capo, sotto, o in una riga che scorre da sola |
| `gutter` | testo a meno di 12 px dal bordo del vetro | di solito un `padding: X 0` (o `style={{ padding }}`) sopra `.wrap`: usa `padding-block` / `paddingBlock` |
| `stacked-buttons` | più di due pulsanti a tutta larghezza uno sopra l'altro | un'azione principale, le altre nel ⋯ o in una riga che scorre |
| `full-width-stat` | una `.stat-card` con un solo numero larga quanto lo schermo | `StatStrip` o due per riga |
| `wide-table` | una tabella più larga del suo riquadro | righe (`ResponsiveTable`/`ListRow`) o colonne che si nascondono |
| `wrapping-tabs` | schede/pillole su due righe | `ScrollTabs`: una riga che scorre |
| `small-field` | un campo sotto 16 px | 16 px sul telefono (sotto, iOS ingrandisce la pagina al tocco) |
| `tall-page` | una pagina dell'app più alta di 8 schermate | togli o chiudi; se la lunghezza è giusta, `screens` sulla rotta in `visual-a11y.ts`, con il motivo |
| `primary-offscreen` | il `[data-primary-action]` non è nella prima schermata né fisso in basso | `StickyActionBar` |
| `under-tabbar` | la fine della pagina finisce sotto la barra delle schede | lo spazio in fondo (`action-bar-spacer`, padding del contenuto) |

Una riga di pillole o schede che scorre di lato può arrivare al bordo: il suo
testo scorre oltre il vetro apposta, e il controllo del margine la salta.

## Eccezioni

Un'eccezione è sempre dichiarata, mai un controllo tolto:
`data-phone-ok="gutter wide-table"` sull'elemento (o un contenitore) vale solo per
le regole nominate. Chi la aggiunge scrive accanto, in un commento, perché.
