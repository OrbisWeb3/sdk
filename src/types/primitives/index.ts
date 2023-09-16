export * from "./schemas.js";
export * from "./indexed.js";

// Match with current schemas
export const OrbisSchemas = {
  post: {
    stream: "kjzl6cwe1jw1498inegtpji0iqf0htspb0qqswlofjy0hak1s3u2pf19qql7oak",
    commit:
      "k1dpgaqe3i64kjuyet4w0zyaqwamf9wrp1jim19y27veqkppo34yghivt2pag4wxp0fv2ykzc0sppqh7zdmujsr7w11y96ofq0guo5q33p1q54opbvw8hvwnj",
  },
  group: {
    stream: "kjzl6cwe1jw1487a0xluwl3ip6lcdcfn8ahgomsbf8x5rf65mktdjuouz8xopbf",
    commit: "k3y52l7qbv1fry2bramzfrq10z2vrywf96yk6n61d8ffsyzvs0k0wd68sanjjo16o",
  },
  project: {
    stream: "kjzl6cwe1jw14936q0quh7drz7a97gw8yw3aoiflwmgsdlf4prnokwywfhhadfn",
    commit:
      "k1dpgaqe3i64kjul5j2lieylhdluzl3wrsae9dgn5n5akr80x6r18pbt68nsg7axlp5pn1warxxgcoq491r9aki0thj6a7goqiogab773qke2w20okq3s94z3",
  },
  context: {
    stream: "kjzl6cwe1jw147dp34t1t88xu2rfltlats6grzav216ko7ocwqz2fgq8myjw8gw",
    commit:
      "k1dpgaqe3i64kjqc8pwu488zrftzkd0fxuex8ou82oc1utpl7nu1168fek2d9d5z00ma9ecmw6x017sievx7htbeaxnsv358ph6kzuyb8pkicv6juxe680910",
  },
  profile: {
    stream: "kjzl6cwe1jw145ak5a52cln1i6ztmece01w5qd03dib4lg8i3tt57sjauu14be8",
    commit:
      "k1dpgaqe3i64kjl5e5a6qgzaczsht05dra2f5jy2ff8lyk0maaxgnic72oqa21n40kt87t5qi8tu8kyt8xt3bkcirey1it476ptgt2omc66kfnldo1jbs4v9v",
  },
  encryptedProfileEmail: {
    stream: "kjzl6cwe1jw147ztpbqz564o0ym42q794j8vf8a9oefny88brcr874jt02j17iw",
    commit: "k3y52l7qbv1fry0ur83jtwrl6uu58zebkw8v3gax0tinebej7mipmaocu8hzclibk",
  },
  reaction: {
    stream: "kjzl6cwe1jw146a2jirsoiku1eqsckmk8o7egba22jufwenwbb9fs096s340efk",
    commit: "k3y52l7qbv1frxonm2thnyc45m0uhleofxo4ms07iq54h2g9xsg3475tc7q4iumm8",
  },
  follow: {
    stream: "kjzl6cwe1jw14av566q7ja9a2jy78uv5ih7pa683ozdulkpsc46qwsxfqzz3po5",
    commit: "k3y52l7qbv1fryl9grzudl4xzm5v7izhj7eersc9m9nmhlfbdi5rzd9przztmejnk",
  },
  conversation: {
    stream: "kjzl6cwe1jw149ibyxllm19uiqvaj4gj2f84lq3y3xzs0nqpo2ufw63ut3xwn7i",
    commit: "k3y52l7qbv1frybmd4exlop211b2ivzpjl89sqho2k1qf8otyj88h0rff301451c0",
  },
  message: {
    stream: "kjzl6cwe1jw14bcux0xa3ba15686iwkw78y4xda0djl58ufyq219e116ihujfh8",
    commit:
      "k1dpgaqe3i64kk0894kb0j6w3oznbcz99blyot3fjkpl3t12zuj0a05yx15yodie1fnsskh5fmcas76fqqjx98lio3yqhce4za88vpbr7f0eda2oebxsga7hx",
  },
  notificationReadTime: {
    stream: "kjzl6cwe1jw14a4hg7d96srbp4tm2lox68ry6uv4m0m3pfsjztxx4pe6rliqquu",
    commit: "k3y52l7qbv1fryfzw38e9ccib6qakyi97weer4rhcskd6cwb26sx7lgkw491a6z9c",
  },
} as const;
