library ieee;
use ieee.std_logic_1164.all;

-- The number on SW3..SW0 is shown as one digit on digit 0; SW15..SW4 are not
-- used. 0..9 show the digit and 10..15 leave the display blank.
entity bcd7Seg is
    port (
        SW : in  std_logic_vector(15 downto 0);
        CA, CB, CC, CD, CE, CF, CG : out std_logic;
        DP : out std_logic;
        AN : out std_logic_vector(7 downto 0)
    );
end entity;

architecture rtl of bcd7Seg is

    -- Segment bits are gfedcba; a zero lights a segment.
    signal segments : std_logic_vector(6 downto 0);

begin

    process (SW(3 downto 0))
    begin
        case SW(3 downto 0) is
            when "0000" => segments <= "1000000";   -- 0
            when "0001" => segments <= "1111001";   -- 1
            when "0010" => segments <= "0100100";   -- 2
            when "0011" => segments <= "0110000";   -- 3
            when "0100" => segments <= "0011001";   -- 4
            when "0101" => segments <= "0010010";   -- 5
            when "0110" => segments <= "0000010";   -- 6
            when "0111" => segments <= "1111000";   -- 7
            when "1000" => segments <= "0000000";   -- 8
            when "1001" => segments <= "0010000";   -- 9
            when others => segments <= "1111111";   -- 10..15: blank
        end case;
    end process;

    CA <= segments(0);
    CB <= segments(1);
    CC <= segments(2);
    CD <= segments(3);
    CE <= segments(4);
    CF <= segments(5);
    CG <= segments(6);
    DP <= '1';                       -- Decimal point off (active low).
    AN <= "11111110";                -- Digit 0 only; the rest stay dark.
end architecture;
