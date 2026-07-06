1\. USERS



USERS

(

&#x20;   user\_id         INT PRIMARY KEY AUTO\_INCREMENT,

&#x20;   name            VARCHAR(100) NOT NULL,

&#x20;   email           VARCHAR(100) UNIQUE NOT NULL,

&#x20;   password        VARCHAR(255) NOT NULL,

&#x20;   phone           VARCHAR(15),

&#x20;   role            ENUM('Customer','Restaurant Admin','System Admin') NOT NULL,

&#x20;   created\_at      DATETIME

)



2\. RESTAURANTS



RESTAURANTS

(

&#x20;   restaurant\_id   INT PRIMARY KEY AUTO\_INCREMENT,

&#x20;   name            VARCHAR(100) NOT NULL,

&#x20;   address         VARCHAR(255),

&#x20;   phone           VARCHAR(15),

&#x20;   description     TEXT,

&#x20;   opening\_time    TIME,

&#x20;   closing\_time    TIME,

&#x20;   status          ENUM('Open','Closed')

)



3\. FOOD\_ITEMS



FOOD\_ITEMS

(

&#x20;   food\_id         INT PRIMARY KEY AUTO\_INCREMENT,

&#x20;   restaurant\_id   INT NOT NULL,

&#x20;   name            VARCHAR(100) NOT NULL,

&#x20;   description     TEXT,

&#x20;   category        VARCHAR(50),

&#x20;   price           DECIMAL(10,2) NOT NULL,

&#x20;   availability    BOOLEAN DEFAULT TRUE,



&#x20;   FOREIGN KEY (restaurant\_id)

&#x20;       REFERENCES RESTAURANTS(restaurant\_id)

)



4\. CART



CART

(

&#x20;   cart\_id         INT PRIMARY KEY AUTO\_INCREMENT,

&#x20;   user\_id         INT NOT NULL,

&#x20;   created\_at      DATETIME,



&#x20;   FOREIGN KEY (user\_id)

&#x20;       REFERENCES USERS(user\_id)

)



5\. CART\_ITEMS



CART\_ITEMS

(

&#x20;   cart\_item\_id    INT PRIMARY KEY AUTO\_INCREMENT,

&#x20;   cart\_id         INT NOT NULL,

&#x20;   food\_id         INT NOT NULL,

&#x20;   quantity        INT NOT NULL,



&#x20;   FOREIGN KEY (cart\_id)

&#x20;       REFERENCES CART(cart\_id),



&#x20;   FOREIGN KEY (food\_id)

&#x20;       REFERENCES FOOD\_ITEMS(food\_id)

)

6\. ORDERS



ORDERS

(

&#x20;   order\_id        INT PRIMARY KEY AUTO\_INCREMENT,

&#x20;   user\_id         INT NOT NULL,

&#x20;   restaurant\_id   INT NOT NULL,

&#x20;   order\_date      DATETIME,

&#x20;   total\_amount    DECIMAL(10,2),

&#x20;   status          ENUM(

&#x20;                       'Pending',

&#x20;                       'Accepted',

&#x20;                       'Preparing',

&#x20;                       'Out for Delivery',

&#x20;                       'Delivered',

&#x20;                       'Cancelled'

&#x20;                   ),



&#x20;   FOREIGN KEY (user\_id)

&#x20;       REFERENCES USERS(user\_id),



&#x20;   FOREIGN KEY (restaurant\_id)

&#x20;       REFERENCES RESTAURANTS(restaurant\_id)

)



7\. ORDER\_ITEMS



ORDER\_ITEMS

(

&#x20;   order\_item\_id   INT PRIMARY KEY AUTO\_INCREMENT,

&#x20;   order\_id        INT NOT NULL,

&#x20;   food\_id         INT NOT NULL,

&#x20;   quantity        INT NOT NULL,

&#x20;   subtotal        DECIMAL(10,2),



&#x20;   FOREIGN KEY (order\_id)

&#x20;       REFERENCES ORDERS(order\_id),



&#x20;   FOREIGN KEY (food\_id)

&#x20;       REFERENCES FOOD\_ITEMS(food\_id)

)



8\. PAYMENTS



PAYMENTS

(

&#x20;   payment\_id      INT PRIMARY KEY AUTO\_INCREMENT,

&#x20;   order\_id        INT NOT NULL,

&#x20;   payment\_method  ENUM(

&#x20;                       'Cash',

&#x20;                       'Credit Card',

&#x20;                       'Debit Card',

&#x20;                       'UPI',

&#x20;                       'Net Banking'

&#x20;                   ),

&#x20;   payment\_status  ENUM(

&#x20;                       'Pending',

&#x20;                       'Successful',

&#x20;                       'Failed'

&#x20;                   ),

&#x20;   amount          DECIMAL(10,2),

&#x20;   payment\_date    DATETIME,



&#x20;   FOREIGN KEY (order\_id)

&#x20;       REFERENCES ORDERS(order\_id)

)



**Relationships:**



| Parent Table | Child Table | Relationship |

| ------------ | ----------- | ------------ |

| USERS        | CART        | 1 : 1        |

| USERS        | ORDERS      | 1 : N        |

| RESTAURANTS  | FOOD\_ITEMS  | 1 : N        |

| RESTAURANTS  | ORDERS      | 1 : N        |

| CART         | CART\_ITEMS  | 1 : N        |

| FOOD\_ITEMS   | CART\_ITEMS  | 1 : N        |

| ORDERS       | ORDER\_ITEMS | 1 : N        |

| FOOD\_ITEMS   | ORDER\_ITEMS | 1 : N        |

| ORDERS       | PAYMENTS    | 1 : 1        |



