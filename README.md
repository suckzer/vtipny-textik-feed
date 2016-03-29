# Feed pro vymysli vtipný textík

Skript v pravidelných intervalech kontroluje záhlaví stránky  
http://www.okoun.cz/boards/vymysli_vtipny_textik . V záhlaví klubu hledá poslední obrázek, který
se v něm vyskytuje. Porovná ho s naposledy nalezeným obrázkem a pokud se obrázek liší,
tak se nový obrázek stáhne a vytvoří se post, který se vloží do Atom feedu. 

Na základě těchto infromací pak vytvoří Atom feed, který lze publikovat třeba přes feed burner.

## "Witty txt" pic feed
Script that regulaly checks for changes of the last picture in the header of 
http://www.okoun.cz/boards/vymysli_vtipny_textik . If it finds a picture different from
the last one known, it downloads it and adds it to an Atom feed. This Atom feed can then be
published on feed burner or elsewhere.

## Branch `replies-grabber`

This traverses all the replies in the discussions and notes all the parts of the discussion, 
including the body, if it's an reply to someone's else contribution, etc. This can be later 
used to reconstruct the feed, download the images etc.
