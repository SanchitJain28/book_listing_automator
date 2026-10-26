## Requirements

## Abebooks family - .com , co.uk , IberLibro

1. It can directly search and get the best result
2. It can read the url and figure out what to do. (can be product or search result)

### Direct ISBN Search

- Search the ISBN on abebooks , if no books found or listed
- If book was not found by ISBN , then search by title on abebooks

### Urls Search

#### URL to target

1. https://www.abebooks.com/9780835212120/Scientific-Engineering-Medical-Societies-Publications-0835212122/plp

- Meant it is product page , fetch it direct

2. https://www.abebooks.com/servlet/SearchResults?an=muller%20max&bi=s&ds=5&sortby=17&tn=lectures%20science%20language%20vol

- It is search result page

- What to do now ? ![alt text](public/image.png)
- Now we have to find the best search result

## Amazon Family - .in , .com , .co.uk

### In this only direct search , no url search

- It is simple as amazon.in , search the isbn -> and get the first listing

## flipkart

### Direct search

- We have to directly search isbn on flipkart like at this url
- https://www.flipkart.com/books/pr?sid=bks&q=9788175102804&otracker=categorytree (Please confirm this url) for searching books

![alt text](image.png)

## bookchor

- We have to directly search isbn on bookchor like at this url
- https://www.bookchor.com/search/?query=9788170770114 (Please confirm this url for searching books)

## Sapna books

- We have to directly search isbn on bookchor like at this url
- https://www.sapnaonline.com/search?keyword=9788188230846 (Please confirm this url for searching books)

## Bookswagon

- We have to directly search isbn on bookchor like at this url
- https://www.bookswagon.com/search-books/9789395185097 (Please confirm this url for searching books)

## Atlantic books

- We have to directly search isbn on bookchor like at this url
- https://atlanticbooks.com/search?q=9788125063247 (Please confirm this url for searching books)

## Mypustak books

- We have to directly search isbn on bookchor like at this url
- https://www.mypustak.com/search?value=9788174734099&page=1 (Please confirm this url for searching books)
- Scraper should target only the first result ,there will be many result in this search result
- ISBN may or may not be matched

## Ahuja books

- Direct ISBN Search not supported
- Skipping

## Om Publications

- We have to directly search isbn on bookchor like at this url
- https://www.ompublications.in/products/search?q=9789326352000 (Please confirm this url for searching books)
