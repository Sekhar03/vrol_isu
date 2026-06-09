import sys

def main():
    with open('client/src/App.jsx', 'r', encoding='utf-8') as f:
        content = f.read()

    # Revert the bad global replace
    content = content.replace('                    </table>\\n                  </div>\\n                  </div>', '                    </table>')
    content = content.replace('                    </table>\\n                  </div>\\n                  </div>', '                    </table>')
    # Actually my previous python script did:
    # content = content.replace('                    </table>', '                    </table>\\n                  </div>\\n                  </div>')
    # Which used \n literally in code string, so it evaluated to newline in string.
    bad_string = "                    </table>\\n                  </div>\\n                  </div>"
    
    # Python `replace` uses literal newline.
    bad_string = "                    </table>\\n                  </div>\\n                  </div>".replace("\\n", "\n")
    content = content.replace(bad_string, "                    </table>")

    # Now selectively close Merchant Portal report table.
    # We added: `<div className="tbl-card" style={{ boxShadow: 'none', border: 'none', background: 'transparent' }}>`
    # and `<div className="tbl-wrap">`
    # Let's find Merchant Portal's activePage === 'reports' section
    
    # Actually, Merchant Portal reports section ends with:
    # `)}` right after `</div>`
    
    with open('client/src/App.jsx', 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == '__main__':
    main()
